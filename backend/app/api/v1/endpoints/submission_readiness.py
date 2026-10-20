"""
Component 3 — pre-submission compliance API.

POST /api/v1/submission-readiness/assess        assess an application
GET  /api/v1/submission-readiness/requirements  checklist for an application type
GET  /api/v1/submission-readiness/{project_id}  latest saved assessment

Assessment is stateless unless ``project_id`` is supplied, in which case the
result is persisted as a ``Report`` row so the dashboard can show the latest
assessment without re-running it.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_id
from app.db.database import get_db
from app.models.project import Project
from app.models.report import Report
from app.schemas.response import (
    ApiResponse,
    ErrorDetail,
    error_response,
    success_response,
)
from app.schemas.submission_readiness import (
    AssessmentRequest,
    AssessmentResult,
    RequirementOutcome,
    RequirementsResponse,
)
from app.services.submission_readiness import risk_model
from app.services.submission_readiness.assessment import assess_application
from app.services.submission_readiness.project_context import (
    derive_context,
    merge_context,
)
from app.services.submission_readiness.requirements_repo import (
    condition_keys,
    for_application_type,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submission-readiness", tags=["Submission Readiness"])

REPORT_TYPE = "SUBMISSION_READINESS"


def _unsupported(application_type: str) -> JSONResponse:
    return JSONResponse(
        # Renamed in newer Starlette; fall back so the pinned range all works.
        status_code=getattr(
            status, "HTTP_422_UNPROCESSABLE_CONTENT", status.HTTP_422_UNPROCESSABLE_ENTITY
        ),
        content=error_response(
            message="Unsupported application type",
            errors=[
                ErrorDetail(
                    code="UNSUPPORTED_APPLICATION_TYPE",
                    message=(
                        f"No official requirements are on record for "
                        f"{application_type!r}. This application needs manual review."
                    ),
                    field="application_type",
                )
            ],
        ),
    )


def _owned_project(db: Session, project_id: int, user_id: int) -> Project | None:
    return (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )


def _project_not_found() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=error_response(
            message="Project not found",
            errors=[
                ErrorDetail(
                    code="PROJECT_NOT_FOUND",
                    message="No project exists with this ID for the current user",
                    field="project_id",
                )
            ],
        ),
    )


@router.get(
    "/requirements",
    response_model=ApiResponse[RequirementsResponse],
    summary="Official requirement checklist for an application type",
)
def get_requirements(application_type: str = Query(..., description="building_permit | coc")):
    requirements = for_application_type(application_type)
    if not requirements:
        return _unsupported(application_type)

    return success_response(
        data=RequirementsResponse(
            application_type=application_type,  # type: ignore[arg-type]
            requirements=[
                RequirementOutcome(
                    requirement_id=r.requirement_id,
                    document_name=r.document_name,
                    requirement_type=r.requirement_type,
                    # Nothing has been uploaded yet, and a conditional
                    # requirement's applicability is unknown until the caller
                    # supplies its flag.
                    state="missing" if r.requirement_type == "mandatory" else "manual_review",
                    condition=r.condition,
                    authority=r.authority,
                )
                for r in requirements
            ],
            condition_keys=condition_keys(application_type),
        ),
        message=f"{len(requirements)} requirements on record",
    )


@router.post(
    "/assess",
    response_model=ApiResponse[AssessmentResult],
    summary="Assess an application before it is submitted",
)
def assess(
    payload: AssessmentRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if payload.project_id is not None:
        project = _owned_project(db, payload.project_id, user_id)
        if project is None:
            return _project_not_found()

        # Conditions the project's own attributes already settle, so the
        # caller does not have to restate them. Anything the project leaves
        # blank stays absent, and its requirements come back as manual review.
        # An explicit flag in the request overrides the derived one.
        payload = payload.model_copy(
            update={"context": merge_context(derive_context(project), payload.context)}
        )
    result = assess_application(payload)
    if result is None:
        return _unsupported(payload.application_type)

    if payload.project_id is not None:
        report = Report(
            project_id=payload.project_id,
            report_type=REPORT_TYPE,
            clash_data_json=result.model_dump(),
        )
        db.add(report)
        db.commit()

    message = (
        "Assessment complete"
        if result.ml_available
        else "Assessment complete — risk model unavailable, rule findings only"
    )
    return success_response(data=result, message=message)


@router.get(
    "/{project_id}",
    response_model=ApiResponse[AssessmentResult],
    summary="Latest saved assessment for a project",
)
def latest(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if _owned_project(db, project_id, user_id) is None:
        return _project_not_found()

    report = (
        db.query(Report)
        .filter(Report.project_id == project_id, Report.report_type == REPORT_TYPE)
        .order_by(Report.created_at.desc())
        .first()
    )
    if report is None or not report.clash_data_json:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=error_response(
                message="No assessment yet",
                errors=[
                    ErrorDetail(
                        code="NO_ASSESSMENT",
                        message="This project has not been assessed yet",
                        field="project_id",
                    )
                ],
            ),
        )

    return success_response(data=report.clash_data_json, message="Latest assessment")


@router.get(
    "/model/status",
    response_model=ApiResponse[dict],
    summary="Whether the risk model artifact is loadable",
)
def model_status():
    available = risk_model.is_available()
    return success_response(
        data={
            "ml_available": available,
            "model_version": risk_model.MODEL_VERSION if available else None,
            "reason": None if available else risk_model.unavailable_reason(),
        },
        message="Risk model status",
    )
