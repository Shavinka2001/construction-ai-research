"""
Module 4 — Precision Boundary Geo-Marking & Calibration.

1. Convert the AI-detected survey polygon (local metres) into a geo-referenced
   polygon centred on the user's GPS Satellite Anchor.
2. Optional manual calibration: scale the polygon so its area matches a
   ground-truth land area in perches exactly.
3. Apply Sri Lankan UDA Planning Regulations (Gazette 2021) setbacks and derive
   the inner 'Optimal Build Zone' via ``polygon.buffer(-setback)``, clamped to
   the 65% maximum plot-coverage rule.
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top) -----------------------------------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import logging
import math
from typing import Any, Optional

from shapely.affinity import scale as shapely_scale
from shapely.geometry import Polygon, mapping

logger = logging.getLogger(__name__)

PERCH_SQM = 25.2929
_EARTH_M_PER_DEG = 111_320.0

# UDA Planning & Development Regulations (Gazette Extraordinary, 2021)
FRONT_SETBACK_M = 3.0   # road / street-line reservation (~10 ft)
REAR_SETBACK_M = 2.3    # rear yard (~7.5 ft)
SIDE_SETBACK_M = 1.5    # each side yard (~5 ft)
MAX_PLOT_COVERAGE = 0.65  # 65% of total lot area


def _square_lot(perches: float) -> list[list[float]]:
    side = math.sqrt(perches * PERCH_SQM)
    h = side / 2.0
    return [[-h, -h], [h, -h], [h, h], [-h, h]]


def _to_lonlat(poly_m: Polygon, lat0: float, lon0: float) -> dict[str, Any]:
    """Local ENU metres -> EPSG:4326 via an equirectangular approximation."""
    m_per_deg_lon = _EARTH_M_PER_DEG * math.cos(math.radians(lat0))
    ring = [
        [lon0 + x / m_per_deg_lon, lat0 + y / _EARTH_M_PER_DEG]
        for x, y in poly_m.exterior.coords
    ]
    return {
        "type": "Feature",
        "properties": {"crs": "EPSG:4326"},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def _coords(poly: Polygon) -> list[list[float]]:
    return [[round(x, 4), round(y, 4)] for x, y in poly.exterior.coords]


def _largest_polygon(geom: Any) -> Optional[Polygon]:
    if geom.is_empty:
        return None
    if geom.geom_type == "Polygon":
        return geom
    if geom.geom_type == "MultiPolygon":
        return max(geom.geoms, key=lambda g: g.area)
    return None


def geo_mark_boundary(
    anchor_lat: float,
    anchor_lon: float,
    polygon_m: Optional[list[list[float]]] = None,
    calibration_perches: Optional[float] = None,
) -> dict[str, Any]:
    notes: list[str] = []

    if polygon_m and len(polygon_m) >= 3:
        lot = Polygon(polygon_m)
        if not lot.is_valid:
            lot = lot.buffer(0)
            lot = _largest_polygon(lot) or lot
    elif calibration_perches:
        lot = Polygon(_square_lot(calibration_perches))
        notes.append(
            "No survey polygon supplied; synthesized a square lot from the perch value."
        )
    else:
        raise ValueError("Provide either polygon_m or calibration_perches")

    # Re-centre on centroid so geo-referencing is about the anchor point
    cx, cy = lot.centroid.x, lot.centroid.y
    lot = Polygon([(x - cx, y - cy) for x, y in lot.exterior.coords])

    calibrated = False
    if calibration_perches and calibration_perches > 0 and lot.area > 0:
        target = calibration_perches * PERCH_SQM
        factor = math.sqrt(target / lot.area)
        lot = shapely_scale(lot, xfact=factor, yfact=factor, origin=(0, 0))
        calibrated = True
        notes.append(
            f"Calibrated boundary to {calibration_perches:g} perches "
            f"({target:.1f} m2) — scale factor {factor:.4f}."
        )

    lot_area = lot.area

    # --- Optimal Build Zone -------------------------------------------------
    # Base inset by the side-yard setback, then bias the front & rear edges.
    inset = lot.buffer(-SIDE_SETBACK_M, join_style=2)
    build_zone = _largest_polygon(inset)
    if build_zone is None or build_zone.is_empty:
        build_zone = lot.buffer(-min(SIDE_SETBACK_M, 0.4 * math.sqrt(lot_area)), join_style=2)
        build_zone = _largest_polygon(build_zone) or lot
        notes.append("Lot too small for full side setbacks; build zone reduced proportionally.")
    else:
        extra = lot.buffer(-FRONT_SETBACK_M, join_style=2)
        extra_poly = _largest_polygon(extra)
        if extra_poly is not None and not extra_poly.is_empty:
            build_zone = build_zone.intersection(
                extra_poly.buffer(FRONT_SETBACK_M - SIDE_SETBACK_M, join_style=2)
            )
            build_zone = _largest_polygon(build_zone) or build_zone

    # --- 65% max plot coverage -------------------------------------------
    max_cover_area = MAX_PLOT_COVERAGE * lot_area
    if build_zone.area > max_cover_area and build_zone.area > 0:
        shrink = math.sqrt(max_cover_area / build_zone.area)
        bcx, bcy = build_zone.centroid.x, build_zone.centroid.y
        build_zone = shapely_scale(build_zone, xfact=shrink, yfact=shrink, origin=(bcx, bcy))
        notes.append(
            f"Build zone capped at the 65% plot-coverage limit ({max_cover_area:.1f} m2)."
        )

    build_area = max(build_zone.area, 0.0)
    coverage_pct = round(100 * build_area / lot_area, 1) if lot_area else 0.0

    setbacks = [
        {"edge": "Front (road / street line)", "requirement_m": FRONT_SETBACK_M, "basis": "UDA Gazette 2021 — ~10 ft"},
        {"edge": "Rear yard", "requirement_m": REAR_SETBACK_M, "basis": "UDA Gazette 2021 — ~7.5 ft"},
        {"edge": "Side yard (each)", "requirement_m": SIDE_SETBACK_M, "basis": "UDA Gazette 2021 — ~5 ft"},
    ]

    return {
        "lot_geojson": _to_lonlat(lot, anchor_lat, anchor_lon),
        "build_zone_geojson": _to_lonlat(build_zone, anchor_lat, anchor_lon),
        "lot_polygon_m": _coords(lot),
        "build_zone_polygon_m": _coords(build_zone),
        "lot_area_sqm": round(lot_area, 2),
        "lot_area_perches": round(lot_area / PERCH_SQM, 3),
        "build_zone_area_sqm": round(build_area, 2),
        "plot_coverage_pct": coverage_pct,
        "max_plot_coverage_pct": round(MAX_PLOT_COVERAGE * 100, 1),
        "setbacks": setbacks,
        "calibrated": calibrated,
        "notes": notes,
    }
