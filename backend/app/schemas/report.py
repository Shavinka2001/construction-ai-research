"""Pydantic schemas for project analysis reports."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    project_id: int
    report_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description='Report category, e.g. "FEASIBILITY", "CLASH", "BOQ"',
    )
    blueprint_url_arch: Optional[str] = Field(None, max_length=2048)
    blueprint_url_struct: Optional[str] = Field(None, max_length=2048)
    clash_data_json: Optional[dict[str, Any]] = Field(
        None,
        description=(
            "Structured analysis payload: detections, severity, and "
            "generative resolution-suggestion coordinates"
        ),
    )


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    report_type: str
    blueprint_url_arch: Optional[str] = None
    blueprint_url_struct: Optional[str] = None
    clash_data_json: Optional[dict[str, Any]] = None
    created_at: datetime
