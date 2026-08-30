"""Clash detection response schemas for Component 2."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class DetectionOut(BaseModel):
    """Single detected element (door/window/column/wall) on the registered canvas."""

    id: str
    label: str
    confidence: float = Field(..., description="Confidence score 0–100")
    bbox: Optional[List[float]] = Field(
        None,
        description="Absolute [xmin, ymin, xmax, ymax] on the 1024×1024 canvas",
    )
    top: str = Field(..., description="CSS-style percentage, e.g. '12.50%'")
    left: str
    width: str
    height: str
    source: Optional[str] = Field(
        None, description="'architectural' or 'structural'"
    )
    kind: Optional[str] = Field(
        None, description="'opening' | 'column' | 'wall' | 'other'"
    )
    wall_type: Optional[Literal["LOAD_BEARING", "PARTITION"]] = None
    thickness_m: Optional[float] = None
    aligns_with_column: Optional[bool] = None
    orientation: Optional[str] = Field(
        None, description="'horizontal' | 'vertical' (AABB long axis)"
    )
    x1: Optional[float] = Field(
        None, description="Wall centreline start X on the registered canvas"
    )
    y1: Optional[float] = Field(
        None, description="Wall centreline start Y (origin top-left, Y-down)"
    )
    x2: Optional[float] = Field(None, description="Wall centreline end X")
    y2: Optional[float] = Field(None, description="Wall centreline end Y")
    is_ai_generated: Optional[bool] = Field(
        False,
        description="True when column was synthesized by the AI-GSL engine",
    )


class WallClassificationItem(BaseModel):
    id: str
    wall_type: Literal["LOAD_BEARING", "PARTITION"]
    thickness_m: float
    aligns_with_column: bool = False
    label: Optional[str] = None


class WallClassificationsOut(BaseModel):
    load_bearing_count: int = 0
    partition_count: int = 0
    thickness_threshold_m: float = 0.23
    items: List[WallClassificationItem] = Field(default_factory=list)


class CrossVentilationRoomOut(BaseModel):
    room_id: str
    bbox: Optional[List[float]] = None
    opening_ids: List[str] = Field(default_factory=list)
    sides_with_openings: List[str] = Field(default_factory=list)
    CROSS_VENTILATION: Literal["PASSED", "WARNING"]
    recommendation: Optional[str] = None


class CrossVentilationOut(BaseModel):
    CROSS_VENTILATION: Literal["PASSED", "WARNING"]
    status: Literal["PASSED", "WARNING"]
    rooms: List[CrossVentilationRoomOut] = Field(default_factory=list)
    recommendation: Optional[str] = None
    summary: Optional[str] = None


class SolarGainOut(BaseModel):
    SOLAR_GAIN: Literal["OK", "HIGH_WEST_EXPOSURE"]
    status: Literal["OK", "HIGH_WEST_EXPOSURE"]
    orientation: str = "NORTH_UP"
    west_facing_living_windows: List[dict] = Field(default_factory=list)
    recommendation: Optional[str] = None
    summary: Optional[str] = None


class ArchitecturalAuditOut(BaseModel):
    """Passive design + structural integrity audit bundle."""

    wall_classifications: WallClassificationsOut = Field(
        default_factory=WallClassificationsOut
    )
    cross_ventilation: CrossVentilationOut
    solar_gain: SolarGainOut



class ClashCoordinates(BaseModel):
    """Pixel boxes used by the UI to highlight a clash region."""

    column_bbox: List[float]
    opening_bbox: List[float]
    intersection_bbox: Optional[List[float]] = None


class ClashOut(BaseModel):
    """Active geometric clash between a structural column and an opening."""

    clash_id: Optional[str] = None
    id: str
    title: str
    severity: Literal["CRITICAL", "WARNING"]
    description: str
    coordinates: Optional[ClashCoordinates] = None
    iou: Optional[float] = None
    overlap_ratio: Optional[float] = Field(
        None, description="Initial intersection / smaller-box area (0–1)"
    )
    opening_id: Optional[str] = None
    column_id: Optional[str] = None


class GcrRecommendationOut(BaseModel):
    """
    Generative Clash Resolution suggestion with closed-loop mathematical proof.

    After the AI proposes a column shift, the backend re-applies the delta to the
    column bbox and recomputes overlap against the static opening. A status of
    ``VERIFIED_SAFE`` means recalculated_overlap is exactly 0.0.
    """

    id: str
    title: str
    prescription: str
    target_detection_id: str
    delta_x: float
    delta_y: float
    clash_id: Optional[str] = None
    initial_overlap: float = Field(
        0.0, description="Pre-shift overlap ratio (0–1)"
    )
    recalculated_overlap: float = Field(
        0.0, description="Post-shift overlap ratio; 0.0 when VERIFIED_SAFE"
    )
    status: Literal["VERIFIED_SAFE", "VERIFICATION_FAILED"] = "VERIFIED_SAFE"
    verification_log: Optional[str] = Field(
        None,
        description=(
            "Clash ID -> Initial Overlap % -> AI Shift -> "
            "Recalculated Overlap 0% (Verified)"
        ),
    )


class HouseCutoutOut(BaseModel):
    """Concave inset (car porch / veranda) in pixel coordinates."""

    min_x: float
    min_y: float
    max_x: float
    max_y: float
    corner: str = "se"


class HouseBoundsOut(BaseModel):
    """
    True pixel footprint of the building after the drawing-sheet frame is
    filtered out. The 3D viewport centres and scales on this box so walls,
    doors and windows share one aligned origin.
    """

    min_x: float
    min_y: float
    max_x: float
    max_y: float
    center_x: float
    center_y: float
    width: float
    height: float
    cutout: Optional[HouseCutoutOut] = None


class ClashMeta(BaseModel):
    openings_count: int
    columns_count: int
    clashes_count: int
    canvas_width: int
    canvas_height: int
    job_id: str
    registration: Optional[str] = None
    walls_count: Optional[int] = None
    generative_structural_layout: Optional[bool] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    house_bounds: Optional[HouseBoundsOut] = None


class ClashDetectionResult(BaseModel):
    """
    Payload returned by POST /architect/clash-detection.

    Primary fields follow the hybrid CV spec; ``detections`` is retained for
    the existing Next.js canvas normalizer.
    """

    image_width: int = Field(
        1024, description="Registered blueprint canvas width in pixels"
    )
    image_height: int = Field(
        1024, description="Registered blueprint canvas height in pixels"
    )
    architectural_detections: List[DetectionOut] = Field(default_factory=list)
    structural_detections: List[DetectionOut] = Field(default_factory=list)
    walls: List[DetectionOut] = Field(default_factory=list)
    house_bounds: Optional[HouseBoundsOut] = None
    clashes: List[ClashOut]
    recommendations: List[GcrRecommendationOut] = Field(default_factory=list)
    architectural_audit: Optional[ArchitecturalAuditOut] = None
    detections: List[DetectionOut] = Field(
        default_factory=list,
        description="Combined arch + struct + wall detections (frontend alias)",
    )
    model: str
    elements_detected: int
    is_ai_generated: bool = Field(
        False,
        description="True when structural columns were AI-GSL synthesized (no file_struct)",
    )
    meta: Optional[ClashMeta] = None
