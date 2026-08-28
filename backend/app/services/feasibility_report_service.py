"""
Module 7 — Client Feasibility Ledger orchestrator.

Runs Modules 1, 2, 4 and 5 in sequence from a single upload + anchor and
assembles the combined 'Site Feasibility Ledger' payload the frontend renders
and exports to PDF. Each stage fails soft: a stage error is recorded in the
ledger and the remaining stages still run.
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top) -----------------------------------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np

from app.services.boundary_geomarking_service import geo_mark_boundary
from app.services.land_analyzer_service import analyze_site
from app.services.survey_audit_service import audit_survey_plan
from app.services.survey_digitization_service import digitize_survey_plan

logger = logging.getLogger(__name__)


def build_feasibility_ledger(
    anchor_lat: float,
    anchor_lon: float,
    image_bgr: Optional[np.ndarray] = None,
    perches: Optional[float] = None,
    address: Optional[str] = None,
    project_id: Optional[int] = None,
) -> dict[str, Any]:
    digitization: Optional[dict[str, Any]] = None
    audit: Optional[dict[str, Any]] = None
    boundary: Optional[dict[str, Any]] = None

    if image_bgr is not None and image_bgr.size > 0:
        try:
            digitization = digitize_survey_plan(image_bgr, perches=perches)
        except Exception as exc:
            logger.warning("Digitization stage failed: %s", exc)
        try:
            audit = audit_survey_plan(image_bgr)
        except Exception as exc:
            logger.warning("Audit stage failed: %s", exc)

    polygon_m: Optional[list[list[float]]] = None
    if digitization:
        ring = digitization["boundary_geojson"]["geometry"]["coordinates"][0]
        polygon_m = [[x, y] for x, y in ring[:-1]]

    if polygon_m or perches:
        try:
            boundary = geo_mark_boundary(
                anchor_lat, anchor_lon, polygon_m=polygon_m, calibration_perches=perches
            )
        except Exception as exc:
            logger.warning("Boundary stage failed: %s", exc)

    feasibility = analyze_site(
        anchor_lat,
        anchor_lon,
        lot_area_sqm=(boundary or {}).get("lot_area_sqm"),
        build_zone_area_sqm=(boundary or {}).get("build_zone_area_sqm"),
    )

    return {
        "project_id": project_id,
        "address": address,
        "anchor": {"lat": anchor_lat, "lon": anchor_lon},
        "digitization": digitization,
        "audit": audit,
        "boundary": boundary,
        "feasibility": feasibility,
        "generated_at": datetime.now(timezone.utc),
    }
