"""
Pre-Construction Feasibility Analyzer API (R26_IT_154).

POST /api/v1/land-validation/digitize     — Module 1  survey-plan digitization
POST /api/v1/land-validation/audit        — Module 2  regulatory / mistake audit
GET  /api/v1/land-validation/search       — Module 3  geocoding proxy (Nominatim)
POST /api/v1/land-validation/boundary     — Module 4  metric boundary + build zone
GET  /api/v1/land-validation/analyze      — Module 5  GIS + weather + buildability
POST /api/v1/land-validation/feasibility  — Modules 1,2,4,5,7  full ledger
POST /api/v1/land-validation/reports      — Module 7  persist a ledger (auth)
GET  /api/v1/land-validation/reports/{id} — Module 7  list ledgers for a project (auth)
"""

from __future__ import annotations

import logging
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_id
from app.db.database import get_db
from app.models.project import Project
from app.models.report import Report
from app.schemas.land_validation import (
    BoundaryRequest,
    BoundaryResult,
    FeasibilityResult,
    GeocodeResult,
    LedgerReport,
    SavedReportOut,
    SaveReportRequest,
    SurveyAuditResult,
    SurveyDigitizeResult,
)
from app.schemas.response import ApiResponse, ErrorDetail, error_response, success_response
from app.services.boundary_geomarking_service import geo_mark_boundary
from app.services.feasibility_report_service import build_feasibility_ledger
from app.services.geocoding_service import geocode
from app.services.land_analyzer_service import analyze_site
from app.services.survey_audit_service import audit_survey_plan
from app.services.survey_digitization_service import digitize_survey_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/land-validation", tags=["Land Validation"])

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
MAX_IMAGE_BYTES = 25 * 1024 * 1024


async def _read_image(upload: UploadFile) -> np.ndarray:
    """Decode an uploaded raster to a BGR ndarray, enforcing the size cap."""
    name = (upload.filename or "").lower()
    if name and not any(name.endswith(ext) for ext in ALLOWED_IMAGE_EXT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXT))}",
        )
    data = await upload.read()
    await upload.close()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds the 25 MB limit",
        )
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode the image file",
        )
    return image


def _fail(message: str, code: str, exc: Exception) -> JSONResponse:
    logger.exception(message)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response(
            message=message,
            errors=[ErrorDetail(code=code, message=str(exc))],
        ),
    )


def _owned_project_or_404(db: Session, project_id: int, user_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


# --------------------------------------------------------------------------- #
# Module 1 — digitize
# --------------------------------------------------------------------------- #
@router.post(
    "/digitize",
    response_model=ApiResponse[SurveyDigitizeResult],
    summary="Digitize a survey plan into a metric boundary polygon",
)
async def digitize(
    file: UploadFile = File(..., description="Survey plan / deed image"),
    perches: Optional[float] = Form(None, description="Ground-truth land area in perches"),
    scale: Optional[float] = Form(None, description="Map scale denominator, e.g. 500 for 1:500"),
):
    try:
        image = await _read_image(file)
        result = digitize_survey_plan(image, perches=perches, scale_ratio=scale)
        return success_response(data=result, message="Survey plan digitized")
    except HTTPException:
        raise
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                message="Could not digitize the survey plan",
                errors=[ErrorDetail(code="DIGITIZE_FAILED", message=str(exc))],
            ),
        )
    except Exception as exc:
        return _fail("Digitization pipeline failed", "DIGITIZE_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 2 — audit
# --------------------------------------------------------------------------- #
@router.post(
    "/audit",
    response_model=ApiResponse[SurveyAuditResult],
    summary="Audit a survey plan against Sri Lankan Survey Dept / UDA rules",
)
async def audit(file: UploadFile = File(..., description="Survey plan image")):
    try:
        image = await _read_image(file)
        result = audit_survey_plan(image)
        return success_response(data=result, message="Survey plan audited")
    except HTTPException:
        raise
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                message="Could not audit the survey plan",
                errors=[ErrorDetail(code="AUDIT_FAILED", message=str(exc))],
            ),
        )
    except Exception as exc:
        return _fail("Audit pipeline failed", "AUDIT_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 3 — geocoding proxy
# --------------------------------------------------------------------------- #
@router.get(
    "/search",
    response_model=ApiResponse[list[GeocodeResult]],
    summary="Geocode an address or place (Nominatim proxy)",
)
def search(q: str = Query(..., min_length=2, description="Address or place name")):
    try:
        results = geocode(q)
        return success_response(data=results, message=f"{len(results)} match(es)")
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response(
                message="Invalid search query",
                errors=[ErrorDetail(code="BAD_QUERY", message=str(exc))],
            ),
        )
    except RuntimeError as exc:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=error_response(
                message="Geocoding service unavailable",
                errors=[ErrorDetail(code="GEOCODER_DOWN", message=str(exc))],
            ),
        )
    except Exception as exc:
        return _fail("Geocoding failed", "GEOCODE_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 4 — boundary geo-marking
# --------------------------------------------------------------------------- #
@router.post(
    "/boundary",
    response_model=ApiResponse[BoundaryResult],
    summary="Geo-reference a boundary polygon and derive the Optimal Build Zone",
)
def boundary(payload: BoundaryRequest):
    try:
        result = geo_mark_boundary(
            payload.anchor.lat,
            payload.anchor.lon,
            polygon_m=payload.polygon_m,
            calibration_perches=payload.calibration_perches,
        )
        return success_response(data=result, message="Boundary geo-marked")
    except ValueError as exc:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                message="Could not geo-mark the boundary",
                errors=[ErrorDetail(code="BOUNDARY_FAILED", message=str(exc))],
            ),
        )
    except Exception as exc:
        return _fail("Boundary pipeline failed", "BOUNDARY_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 5 — feasibility + disaster
# --------------------------------------------------------------------------- #
@router.get(
    "/analyze",
    response_model=ApiResponse[FeasibilityResult],
    summary="Run GIS topography, terrain, flood, weather and buildability scoring",
)
def analyze(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    lot_area: Optional[float] = Query(None, gt=0, description="Calibrated lot area (m2)"),
    build_area: Optional[float] = Query(None, gt=0, description="Build-zone area (m2)"),
):
    try:
        result = analyze_site(lat, lon, lot_area_sqm=lot_area, build_zone_area_sqm=build_area)
        return success_response(data=result, message="Site analyzed")
    except Exception as exc:
        return _fail("Site analysis failed", "ANALYZE_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 7 — full ledger
# --------------------------------------------------------------------------- #
@router.post(
    "/feasibility",
    response_model=ApiResponse[LedgerReport],
    summary="Run Modules 1,2,4,5 from one upload + anchor and return the ledger",
)
async def feasibility(
    lat: float = Form(..., ge=-90, le=90),
    lon: float = Form(..., ge=-180, le=180),
    perches: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    project_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None, description="Optional survey plan image"),
):
    try:
        image = None
        if file is not None and getattr(file, "filename", None):
            image = await _read_image(file)
        ledger = build_feasibility_ledger(
            anchor_lat=lat,
            anchor_lon=lon,
            image_bgr=image,
            perches=perches,
            address=address,
            project_id=project_id,
        )
        return success_response(data=ledger, message="Feasibility ledger generated")
    except HTTPException:
        raise
    except Exception as exc:
        return _fail("Feasibility ledger failed", "FEASIBILITY_ERROR", exc)


# --------------------------------------------------------------------------- #
# Module 7 — persistence
# --------------------------------------------------------------------------- #
@router.post(
    "/reports",
    response_model=ApiResponse[SavedReportOut],
    status_code=status.HTTP_201_CREATED,
    summary="Persist a Site Feasibility Ledger to a project",
)
def save_report(
    payload: SaveReportRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    _owned_project_or_404(db, payload.project_id, user_id)
    report = Report(
        project_id=payload.project_id,
        report_type="FEASIBILITY",
        clash_data_json={
            "address": payload.address,
            "ledger": payload.ledger.model_dump(mode="json"),
        },
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return success_response(
        data=SavedReportOut.model_validate(report).model_dump(mode="json"),
        message="Feasibility ledger saved",
    )


@router.get(
    "/reports/{project_id}",
    response_model=ApiResponse[list[SavedReportOut]],
    summary="List saved Site Feasibility Ledgers for a project",
)
def list_reports(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    _owned_project_or_404(db, project_id, user_id)
    reports = (
        db.query(Report)
        .filter(Report.project_id == project_id, Report.report_type == "FEASIBILITY")
        .order_by(Report.created_at.desc())
        .all()
    )
    return success_response(
        data=[SavedReportOut.model_validate(r).model_dump(mode="json") for r in reports],
        message=f"{len(reports)} ledger(s)",
    )
