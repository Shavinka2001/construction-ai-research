"""Pydantic schemas for project portfolio management."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    location_gps: Optional[str] = Field(
        None,
        max_length=255,
        description="GPS coordinates or geocode string, e.g. '6.9271,79.8612'",
    )


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    location_gps: Optional[str] = None
    user_id: int
    created_at: datetime
