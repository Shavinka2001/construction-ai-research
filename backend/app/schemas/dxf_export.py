"""Schemas for AutoCAD DXF export of resolved blueprint layouts."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class DxfEntityBox(BaseModel):
    """Axis-aligned entity on the registered 1024×1024 canvas (image/CV space)."""

    id: str = Field(..., description="Stable element id, e.g. C2, D1, W1")
    bbox: List[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Absolute [xmin, ymin, xmax, ymax] in canvas pixels (Y-down)",
    )
    label: Optional[str] = None
    resolved: bool = False


class DxfLayoutPayload(BaseModel):
    """
    Complete floor-plan geometry persisted on ``Report.clash_data_json``
    and consumed by ``GET /architect/export-dxf/{report_id}``.

    Layers written to DXF: WALLS, COLUMNS, DOORS, WINDOWS.
    """

    canvas_size: int = Field(1024, ge=64, le=8192)
    walls: List[DxfEntityBox] = Field(default_factory=list)
    columns: List[DxfEntityBox] = Field(default_factory=list)
    doors: List[DxfEntityBox] = Field(default_factory=list)
    windows: List[DxfEntityBox] = Field(default_factory=list)


class ClashLayoutReportCreate(BaseModel):
    """Create / refresh a CLASH report that can later be exported as DXF."""

    project_id: int
    layout: DxfLayoutPayload
    blueprint_url_arch: Optional[str] = None
    blueprint_url_struct: Optional[str] = None


class ClashLayoutReportOut(BaseModel):
    report_id: int
    project_id: int
    report_type: Literal["CLASH"] = "CLASH"
    message: str = "Clash layout report saved for DXF export"
