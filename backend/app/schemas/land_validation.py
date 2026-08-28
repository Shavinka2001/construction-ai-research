"""
Pydantic schemas for the Pre-Construction Feasibility Analyzer (R26_IT_154).

Covers the 7 modules:
  1. Survey plan AI digitization        -> SurveyDigitizeResult
  2. Sri Lankan survey / regulatory audit -> SurveyAuditResult
  3. Satellite location finder            -> GeocodeResult
  4. Precision boundary geo-marking       -> BoundaryResult
  5. Multi-factor feasibility + disaster  -> FeasibilityResult
  6. 3D visualization                     -> consumes terrain + build zone
  7. Client feasibility ledger + PDF      -> LedgerReport
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# GeoJSON is passed through as free-form dicts to avoid a rigid geometry model.
GeoJson = dict[str, Any]

AuditStatus = Literal["PRESENT", "MISSING", "UNVERIFIED"]


# --------------------------------------------------------------------------- #
# Module 3 — geocoding
# --------------------------------------------------------------------------- #
class GeocodeResult(BaseModel):
    display_name: str
    lat: float
    lon: float
    type: Optional[str] = None
    bounding_box: Optional[list[float]] = Field(
        None, description="[south, north, west, east] as returned by Nominatim"
    )


# --------------------------------------------------------------------------- #
# Module 1 — survey plan digitization
# --------------------------------------------------------------------------- #
class SurveyDigitizeResult(BaseModel):
    method: str = Field(..., description="yolov8-seg | yolov8n-seg-fallback | opencv-contour")
    boundary_geojson: GeoJson = Field(
        ..., description="Polygon in local metric coordinates, origin at centroid"
    )
    pixel_polygon: list[list[float]] = Field(
        ..., description="Outer boundary as [[x, y], ...] in image pixels"
    )
    scale_source: str = Field(..., description="detected-scale | manual-perch | assumed")
    meters_per_pixel: float
    area_sqm: float
    area_perches: float
    perimeter_m: float
    image_width: int
    image_height: int
    notes: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Module 2 — regulatory audit
# --------------------------------------------------------------------------- #
class AuditElement(BaseModel):
    key: str
    label: str
    status: AuditStatus
    evidence: Optional[str] = Field(
        None, description="Matched text snippet / detection note"
    )
    advisory: list[str] = Field(
        default_factory=list,
        description="Step-by-step rectification guide when MISSING / UNVERIFIED",
    )


class SurveyAuditResult(BaseModel):
    ocr_available: bool
    ocr_engine: Optional[str] = None
    text_excerpt: Optional[str] = None
    elements: list[AuditElement]
    present_count: int
    missing_count: int
    unverified_count: int
    compliance_score: int = Field(..., ge=0, le=100)
    summary: str


# --------------------------------------------------------------------------- #
# Module 4 — precision boundary geo-marking
# --------------------------------------------------------------------------- #
class Anchor(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class BoundaryRequest(BaseModel):
    anchor: Anchor
    polygon_m: Optional[list[list[float]]] = Field(
        None,
        description="Boundary in local metres [[x_east, y_north], ...]. "
        "If omitted, a square lot is synthesized from calibration_perches.",
    )
    calibration_perches: Optional[float] = Field(
        None, gt=0, description="Ground-truth land area in perches (1 perch = 25.2929 m2)"
    )


class SetbackRow(BaseModel):
    edge: str
    requirement_m: float
    basis: str


class BoundaryResult(BaseModel):
    lot_geojson: GeoJson = Field(..., description="Lot polygon in EPSG:4326 (lon, lat)")
    build_zone_geojson: GeoJson = Field(
        ..., description="Optimal Build Zone polygon in EPSG:4326 (lon, lat)"
    )
    lot_polygon_m: list[list[float]]
    build_zone_polygon_m: list[list[float]]
    lot_area_sqm: float
    lot_area_perches: float
    build_zone_area_sqm: float
    plot_coverage_pct: float
    max_plot_coverage_pct: float
    setbacks: list[SetbackRow]
    calibrated: bool
    notes: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Module 5 — multi-factor feasibility + disaster assessment
# --------------------------------------------------------------------------- #
class TopographyResult(BaseModel):
    elevation_m: float
    slope_deg: float
    transect_ew_m: list[float] = Field(..., description="14-point E-W elevation profile")
    source: str = Field(..., description="gee | synthetic")


class TerrainResult(BaseModel):
    worldcover_class: str
    suitability: str
    penalty_note: Optional[str] = None
    source: str


class FloodResult(BaseModel):
    water_occurrence_pct: float
    risk_band: Literal["Low", "Moderate", "Flood Zone"]
    source: str


class WeatherResult(BaseModel):
    temperature_2m: Optional[float] = None
    relative_humidity_2m: Optional[float] = None
    precipitation: Optional[float] = None
    precipitation_sum_7d: Optional[float] = None
    uv_index_max: Optional[float] = None
    rainfall_exposure: str
    solar_exposure: str
    advisories: list[str] = Field(default_factory=list)
    source: str = Field(..., description="open-meteo | unavailable")


class ScoreFactor(BaseModel):
    key: str
    label: str
    weight_pct: int
    factor_score: int = Field(..., ge=0, le=100)
    reason: str


class FeasibilityResult(BaseModel):
    lat: float
    lon: float
    topography: TopographyResult
    terrain: TerrainResult
    flood: FloodResult
    weather: WeatherResult
    buildability_score: int = Field(..., ge=0, le=100)
    rating: Literal["Poor", "Marginal", "Moderate", "Good", "Excellent"]
    factors: list[ScoreFactor]
    reasons: list[str]
    generated_at: datetime


# --------------------------------------------------------------------------- #
# Module 7 — client feasibility ledger + report persistence
# --------------------------------------------------------------------------- #
class LedgerReport(BaseModel):
    project_id: Optional[int] = None
    address: Optional[str] = None
    anchor: Anchor
    digitization: Optional[SurveyDigitizeResult] = None
    audit: Optional[SurveyAuditResult] = None
    boundary: Optional[BoundaryResult] = None
    feasibility: FeasibilityResult
    generated_at: datetime


class SaveReportRequest(BaseModel):
    project_id: int
    address: Optional[str] = None
    ledger: LedgerReport


class SavedReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    report_type: str
    clash_data_json: Optional[dict[str, Any]] = None
    created_at: datetime
