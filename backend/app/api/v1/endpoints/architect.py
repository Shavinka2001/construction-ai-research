"""
Architect API — Component 2 dual-blueprint clash detection + CAD export.

POST /api/v1/architect/clash-detection
--------------------------------------
Accepts multipart ``file_arch`` (+ optional ``file_struct``), persists under
``backend/uploads/``, then runs the hybrid pipeline:

  • YOLOv8  → doors / windows / openings (architectural plan)
  • OpenCV  → solid column symbols (structural plan), OR
  • AI-GSL  → generative clash-free columns when ``file_struct`` is omitted
  • IoU     → geometric clashes on a shared 1024×1024 canvas
  • Closed-loop GCR re-validation (recalculated_overlap == 0.0)

POST /api/v1/architect/clash-layout-reports
-------------------------------------------
Persists a resolved WALLS/COLUMNS layout on a CLASH ``Report`` so it can be
exported as AutoCAD DXF.

GET /api/v1/architect/export-dxf/{report_id}
-------------------------------------------
Streams a generated ``Resolved_Blueprint_Layout.dxf`` (ezdxf) as FileResponse.
"""

from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.deps import get_current_user_id
from app.db.database import get_db
from app.models.project import Project
from app.models.report import Report
from app.schemas.clash import ClashDetectionResult
from app.schemas.dxf_export import ClashLayoutReportCreate, ClashLayoutReportOut
from app.schemas.response import ApiResponse, ErrorDetail, error_response, success_response
from app.services.clash_detection import detect_clashes
from app.services.dxf_export import DXF_FILENAME, build_resolved_dxf_bytes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/architect", tags=["Architect"])

UPLOADS_DIR = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
DXF_MEDIA_TYPE = "image/vnd.dxf"


def _ensure_uploads_dir() -> Path:
    """Create ``backend/uploads/`` if it does not exist."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOADS_DIR


def _safe_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{suffix or 'unknown'}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )
    return suffix


async def _persist_upload(upload: UploadFile, prefix: str) -> Path:
    """
    Stream an ``UploadFile`` to ``backend/uploads/{prefix}_{uuid}{ext}``.

    Enforces the 25 MB size cap and rejects empty payloads.
    """
    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing filename for {prefix} upload",
        )

    suffix = _safe_suffix(upload.filename)
    dest = _ensure_uploads_dir() / f"{prefix}_{uuid.uuid4().hex}{suffix}"

    size = 0
    try:
        with dest.open("wb") as buffer:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    buffer.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds the 25MB size limit",
                    )
                buffer.write(chunk)
    finally:
        await upload.close()

    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Empty file uploaded for {prefix}",
        )

    logger.info("Saved %s upload → %s (%s bytes)", prefix, dest.name, size)
    return dest


def _owned_project_or_404(
    db: Session, project_id: int, user_id: int
) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.post(
    "/clash-detection",
    response_model=ApiResponse[ClashDetectionResult],
    summary="Run dual-blueprint hybrid clash detection or AI-GSL",
    description=(
        "Upload an architectural plan (`file_arch`). Optionally upload a "
        "structural plan (`file_struct`). Both are registered to a 1024×1024 "
        "canvas when provided. YOLOv8 detects doors/windows; OpenCV extracts "
        "columns from `file_struct`, or the AI Generative Structural Layout "
        "(GSL) engine synthesizes clash-free columns when structural is omitted "
        "(`is_ai_generated: true`). Geometric overlap flags CRITICAL / WARNING "
        "clashes. Each GCR recommendation is closed-loop re-validated so "
        "recalculated_overlap is 0.0 (status VERIFIED_SAFE)."
    ),
)
async def clash_detection(
    file_arch: UploadFile = File(
        ..., description="Architectural blueprint (PDF / PNG / JPG)"
    ),
    file_struct: UploadFile | None = File(
        None,
        description=(
            "Optional structural blueprint. When omitted, AI-GSL generates "
            "clash-free columns from architectural walls and openings."
        ),
    ),
):
    """
    Hybrid AI/CV clash-detection endpoint (dual-plan or AI-GSL).

    Returns
    -------
    ApiResponse[ClashDetectionResult]
        ``architectural_detections``, ``structural_detections``, ``clashes``,
        and ``recommendations`` (each with ``recalculated_overlap`` /
        ``status: VERIFIED_SAFE`` after closed-loop IoU re-validation).
        When ``file_struct`` is absent, ``is_ai_generated`` is true.
    """
    arch_path: Path | None = None
    struct_path: Path | None = None

    try:
        # 1) Persist uploads ---------------------------------------------------
        arch_path = await _persist_upload(file_arch, "arch")
        if file_struct is not None and getattr(file_struct, "filename", None):
            struct_path = await _persist_upload(file_struct, "struct")

        # 2–5) YOLOv8 + OpenCV/GSL + IoU pipeline ------------------------------
        result = detect_clashes(arch_path, struct_path)
        ai_gsl = bool(result.get("is_ai_generated"))

        return success_response(
            data=result,
            message=(
                "AI Generative Structural Layout completed successfully"
                if ai_gsl
                else "Clash detection completed successfully"
            ),
        )

    except HTTPException:
        raise
    except ValueError as exc:
        logger.exception("Invalid blueprint input")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response(
                message="Invalid blueprint file",
                errors=[
                    ErrorDetail(
                        code="INVALID_BLUEPRINT",
                        message=str(exc),
                    )
                ],
            ),
        )
    except Exception as exc:
        logger.exception("Clash detection pipeline failed")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                message="Clash detection failed",
                errors=[
                    ErrorDetail(
                        code="CLASH_DETECTION_ERROR",
                        message=str(exc),
                    )
                ],
            ),
        )
    finally:
        # Uploads are retained under backend/uploads/ for audit / reprocessing.
        pass


@router.post(
    "/clash-layout-reports",
    response_model=ApiResponse[ClashLayoutReportOut],
    status_code=status.HTTP_201_CREATED,
    summary="Persist resolved layout for DXF export",
    description=(
        "Stores WALLS + resolved COLUMNS geometry on a CLASH report. "
        "Use the returned ``report_id`` with GET /architect/export-dxf/{report_id}."
    ),
)
def create_clash_layout_report(
    payload: ClashLayoutReportCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Save a resolved blueprint layout snapshot for industrial CAD export."""
    _owned_project_or_404(db, payload.project_id, user_id)

    report = Report(
        project_id=payload.project_id,
        report_type="CLASH",
        blueprint_url_arch=payload.blueprint_url_arch,
        blueprint_url_struct=payload.blueprint_url_struct,
        clash_data_json=payload.layout.model_dump(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return success_response(
        data=ClashLayoutReportOut(
            report_id=report.id,
            project_id=report.project_id,
        ).model_dump(),
        message="Clash layout report saved for DXF export",
    )


@router.get(
    "/export-dxf/{report_id}",
    summary="Export resolved blueprint as AutoCAD DXF",
    description=(
        "Loads the CLASH report layout and streams a complete 2D DXF floor plan "
        "with WALLS (white), COLUMNS (green hatch), DOORS (cyan + swing), and "
        "WINDOWS (yellow) layers via ezdxf. CV Y-axis is inverted to CAD space."
    ),
    responses={
        200: {
            "content": {DXF_MEDIA_TYPE: {}},
            "description": "AutoCAD DXF file download",
        }
    },
)
def export_dxf(
    report_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Generate ``Resolved_Blueprint_Layout.dxf`` for a persisted clash report.

    Layers
    ------
    - WALLS   — outer boundaries
    - COLUMNS — clash-free (recalculated) column footprints with solid hatch
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found",
        )

    # Ownership check through the parent project
    _owned_project_or_404(db, report.project_id, user_id)

    layout = report.clash_data_json or {}
    if not isinstance(layout, dict) or not any(
        layout.get(key)
        for key in ("walls", "columns", "doors", "windows")
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Report has no WALLS/COLUMNS/DOORS/WINDOWS layout "
                "suitable for DXF export"
            ),
        )

    try:
        dxf_bytes = build_resolved_dxf_bytes(layout)
    except Exception as exc:
        logger.exception("DXF generation failed for report %s", report_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate DXF: {exc}",
        ) from exc

    # Write to a temp file so FileResponse can stream the CAD payload
    tmp = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".dxf",
        prefix=f"resolved_blueprint_{report_id}_",
    )
    try:
        tmp.write(dxf_bytes)
        tmp.flush()
        tmp_path = tmp.name
    finally:
        tmp.close()

    return FileResponse(
        path=tmp_path,
        media_type=DXF_MEDIA_TYPE,
        filename=DXF_FILENAME,
    )
