"""
Project portfolio API — multi-project SaaS hub for Construction AI firms.

POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}/reports
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_id
from app.db.database import get_db
from app.models.project import Project
from app.models.report import Report
from app.schemas.project import ProjectCreate, ProjectOut
from app.schemas.report import ReportOut
from app.schemas.response import ApiResponse, ErrorDetail, error_response, success_response

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "",
    response_model=ApiResponse[ProjectOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Creates a project profile owned by the authenticated user.",
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> dict:
    project = Project(
        name=payload.name.strip(),
        description=payload.description,
        location_gps=payload.location_gps,
        user_id=user_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return success_response(
        data=ProjectOut.model_validate(project).model_dump(),
        message="Project created successfully",
    )


@router.get(
    "",
    response_model=ApiResponse[list[ProjectOut]],
    summary="List my projects",
    description="Returns all projects owned by the currently logged-in user.",
)
def list_projects(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> dict:
    projects = (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return success_response(
        data=[ProjectOut.model_validate(p).model_dump() for p in projects],
        message="Projects retrieved successfully",
    )


@router.get(
    "/{project_id}/reports",
    response_model=ApiResponse[list[ReportOut]],
    summary="List project reports",
    description=(
        "Fetches historical feasibility, clash, and BOQ reports for a project "
        "owned by the authenticated user."
    ),
)
def list_project_reports(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if project is None:
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

    reports = (
        db.query(Report)
        .filter(Report.project_id == project_id)
        .order_by(Report.created_at.desc())
        .all()
    )
    return success_response(
        data=[ReportOut.model_validate(r).model_dump() for r in reports],
        message="Reports retrieved successfully",
    )
