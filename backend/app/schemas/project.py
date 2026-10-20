"""Pydantic schemas for project portfolio management."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Mirrors app/models/project_attributes.py. Every one is optional, and a value
# left unset means *unknown*: the readiness rule engine reports the
# requirements that depend on it as manual review rather than assuming they do
# not apply.
ApplicationType = Literal["building_permit", "coc"]
BuildingUse = Literal["residential", "non_residential", "apartment"]
TenureType = Literal["freehold", "condominium"]
ApplicantType = Literal["individual", "organization"]
DevelopmentActivity = Literal["building_construction", "land_subdivision"]


class ProjectApprovalAttributes(BaseModel):
    """
    What the project is, in the terms the approval requirements are written in.

    Filling these in is what lets the readiness engine decide a requirement
    without asking. `building_use` carries the most weight: it gates the
    five-clearance group UDA requires of non-residential buildings and
    apartments.
    """

    application_type: Optional[ApplicationType] = None
    building_use: Optional[BuildingUse] = Field(
        None, description="Gates the non-residential / apartment clearance group"
    )
    tenure_type: Optional[TenureType] = None
    applicant_type: Optional[ApplicantType] = None
    development_activity: Optional[DevelopmentActivity] = Field(
        None, description="Decides nine of the twelve CoC requirements"
    )
    has_ppc: Optional[bool] = Field(
        None, description="Preliminary Planning Clearance already obtained"
    )


class ProjectCreate(ProjectApprovalAttributes):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    location_gps: Optional[str] = Field(
        None,
        max_length=255,
        description="GPS coordinates or geocode string, e.g. '6.9271,79.8612'",
    )


class ProjectUpdate(ProjectApprovalAttributes):
    """Partial update — only the fields present in the request body are changed."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    location_gps: Optional[str] = Field(None, max_length=255)


class ProjectOut(ProjectApprovalAttributes):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    location_gps: Optional[str] = None
    user_id: int
    created_at: datetime
