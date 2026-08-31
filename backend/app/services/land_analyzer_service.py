"""
Module 5 — Multi-Factor Feasibility & Disaster Assessment.

Real-time site analysis:
  * GIS topography     — Google Earth Engine SRTM (elevation, slope, E-W transect)
  * Terrain class      — GEE ESA WorldCover v100
  * Flood / water risk — GEE JRC Global Surface Water occurrence
  * Weather / climate  — Open-Meteo forecast API
  * Explainable buildability score (0-100) with a weighted matrix + reasons

Every GEE call degrades to a deterministic, lat/lon-seeded synthetic model so the
endpoint always responds — dropping in ``gee-key.json`` upgrades it with no code
change.
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top, before networked imports) ----------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import hashlib
import json
import logging
import math
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

import requests

from app.core.config import BASE_DIR, settings

logger = logging.getLogger(__name__)

TRANSECT_POINTS = 14
TRANSECT_SPAN_M = 200.0

_WORLDCOVER = {
    10: ("Tree cover", "Site clearance penalty", "Trees / forest — budget for felling & stump removal"),
    20: ("Shrubland", "Minor clearance", "Shrub clearance required"),
    30: ("Grassland", "High suitability", None),
    40: ("Cropland", "High suitability", None),
    50: ("Built-up", "Existing development", "Built-up — verify demolition / party-wall constraints"),
    60: ("Bare / sparse vegetation", "Excavation penalty", "Bare rock / soil — expect rock excavation cost"),
    70: ("Snow and ice", "Unsuitable", "Permanent snow/ice"),
    80: ("Permanent water bodies", "Unsuitable", "Open water — not buildable"),
    90: ("Herbaceous wetland", "Flood-prone", "Wetland — high water table, drainage engineering required"),
    95: ("Mangroves", "Protected / flood-prone", "Mangrove — likely protected coastal zone"),
    100: ("Moss and lichen", "Marginal", "Thin soil cover"),
}


# --------------------------------------------------------------------------- #
# GEE bootstrap
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _ee() -> Optional[Any]:
    """Initialise Earth Engine with the service-account key, or return None."""
    key_path = (BASE_DIR / settings.GEE_KEY_PATH).resolve()
    if not key_path.is_file():
        logger.info("GEE key not found at %s — using synthetic terrain model", key_path)
        return None
    try:
        import ee  # noqa: PLC0415

        with key_path.open("r", encoding="utf-8") as fh:
            client_email = json.load(fh).get("client_email")
        credentials = ee.ServiceAccountCredentials(client_email, str(key_path))
        ee.Initialize(credentials, project=settings.GEE_PROJECT)
        logger.info("Google Earth Engine initialised (project=%s)", settings.GEE_PROJECT)
        return ee
    except Exception as exc:  # pragma: no cover - env / network dependent
        logger.warning("GEE init failed (%s) — using synthetic terrain model", exc)
        return None


def _seed(lat: float, lon: float) -> float:
    digest = hashlib.sha256(f"{lat:.5f},{lon:.5f}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF  # 0..1


# --------------------------------------------------------------------------- #
# Topography
# --------------------------------------------------------------------------- #
def _topography_gee(ee: Any, lat: float, lon: float) -> dict[str, Any]:
    srtm = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(srtm)
    point = ee.Geometry.Point([lon, lat])

    sample = srtm.addBands(slope).reduceRegion(
        reducer=ee.Reducer.first(), geometry=point, scale=30
    ).getInfo()
    elevation = float(sample.get("elevation") or 0.0)
    slope_deg = float(sample.get("slope") or 0.0)

    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    half = (TRANSECT_SPAN_M / 2.0) / m_per_deg_lon
    xs = [lon - half + (2 * half) * i / (TRANSECT_POINTS - 1) for i in range(TRANSECT_POINTS)]
    fc = ee.FeatureCollection([ee.Feature(ee.Geometry.Point([x, lat])) for x in xs])
    profile = srtm.reduceRegions(collection=fc, reducer=ee.Reducer.first(), scale=30).getInfo()
    transect = [
        round(float(f["properties"].get("first") or elevation), 2)
        for f in profile["features"]
    ]
    return {
        "elevation_m": round(elevation, 2),
        "slope_deg": round(slope_deg, 2),
        "transect_ew_m": transect,
        "source": "gee",
    }


def _topography_synthetic(lat: float, lon: float) -> dict[str, Any]:
    s = _seed(lat, lon)
    base = 5 + s * 120  # 5..125 m
    amp = 1.5 + s * 6
    transect = [
        round(base + amp * math.sin(i / 2.0 + s * 6.28) + (i - TRANSECT_POINTS / 2) * (s - 0.5) * 0.8, 2)
        for i in range(TRANSECT_POINTS)
    ]
    rise = abs(transect[-1] - transect[0])
    slope_deg = round(math.degrees(math.atan2(rise, TRANSECT_SPAN_M)) + s * 3.0, 2)
    return {
        "elevation_m": round(base, 2),
        "slope_deg": slope_deg,
        "transect_ew_m": transect,
        "source": "synthetic",
    }


# --------------------------------------------------------------------------- #
# Terrain classification
# --------------------------------------------------------------------------- #
def _terrain_gee(ee: Any, lat: float, lon: float) -> dict[str, Any]:
    wc = ee.ImageCollection("ESA/WorldCover/v100").first()
    val = wc.reduceRegion(
        reducer=ee.Reducer.first(),
        geometry=ee.Geometry.Point([lon, lat]),
        scale=10,
    ).getInfo()
    code = int(val.get("Map") or 30)
    name, suitability, penalty = _WORLDCOVER.get(code, ("Unknown", "Unclassified", None))
    return {
        "worldcover_class": name,
        "suitability": suitability,
        "penalty_note": penalty,
        "source": "gee",
    }


def _terrain_synthetic(lat: float, lon: float) -> dict[str, Any]:
    s = _seed(lon, lat)  # different axis order -> decorrelated from topography
    code = [30, 40, 30, 10, 60, 90][int(s * 6) % 6]
    name, suitability, penalty = _WORLDCOVER[code]
    return {
        "worldcover_class": name,
        "suitability": suitability,
        "penalty_note": penalty,
        "source": "synthetic",
    }


# --------------------------------------------------------------------------- #
# Flood / surface water
# --------------------------------------------------------------------------- #
def _band(occurrence: float) -> str:
    if occurrence >= 25:
        return "Flood Zone"
    if occurrence >= 5:
        return "Moderate"
    return "Low"


def _flood_gee(ee: Any, lat: float, lon: float) -> dict[str, Any]:
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
    val = gsw.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=ee.Geometry.Point([lon, lat]).buffer(90),
        scale=30,
    ).getInfo()
    occ = float(val.get("occurrence") or 0.0)
    return {"water_occurrence_pct": round(occ, 1), "risk_band": _band(occ), "source": "gee"}


def _flood_synthetic(lat: float, lon: float) -> dict[str, Any]:
    s = _seed(lat + 1.0, lon - 1.0)
    occ = round(max(0.0, (s - 0.55)) * 120, 1)  # mostly 0, occasional high
    return {"water_occurrence_pct": occ, "risk_band": _band(occ), "source": "synthetic"}


# --------------------------------------------------------------------------- #
# Weather (Open-Meteo)
# --------------------------------------------------------------------------- #
def _weather(lat: float, lon: float) -> dict[str, Any]:
    try:
        resp = requests.get(
            settings.OPEN_METEO_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,precipitation",
                "daily": "precipitation_sum,uv_index_max",
                "timezone": "auto",
                "forecast_days": 7,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.warning("Open-Meteo request failed: %s", exc)
        return {
            "temperature_2m": None,
            "relative_humidity_2m": None,
            "precipitation": None,
            "precipitation_sum_7d": None,
            "uv_index_max": None,
            "rainfall_exposure": "Unknown",
            "solar_exposure": "Unknown",
            "advisories": ["Weather service unavailable — retry later."],
            "source": "unavailable",
        }

    current = data.get("current", {})
    daily = data.get("daily", {})
    precip_7d = sum(v for v in (daily.get("precipitation_sum") or []) if v is not None)
    uv_values = [v for v in (daily.get("uv_index_max") or []) if v is not None]
    uv_max = max(uv_values) if uv_values else None

    if precip_7d >= 120:
        rainfall_exposure = "High"
    elif precip_7d >= 40:
        rainfall_exposure = "Moderate"
    else:
        rainfall_exposure = "Low"

    if uv_max is None:
        solar_exposure = "Unknown"
    elif uv_max >= 8:
        solar_exposure = "Very High"
    elif uv_max >= 6:
        solar_exposure = "High"
    else:
        solar_exposure = "Moderate"

    advisories: list[str] = []
    if rainfall_exposure == "High":
        advisories.append(
            "High rolling rainfall — design perimeter / sub-soil drainage and raise the finished floor level."
        )
    if solar_exposure in ("High", "Very High"):
        advisories.append(
            "High UV / solar load — provide roof insulation, shaded openings and consider rooftop solar PV."
        )
    if (current.get("relative_humidity_2m") or 0) >= 80:
        advisories.append("Persistently high humidity — specify cross-ventilation and mould-resistant finishes.")

    return {
        "temperature_2m": current.get("temperature_2m"),
        "relative_humidity_2m": current.get("relative_humidity_2m"),
        "precipitation": current.get("precipitation"),
        "precipitation_sum_7d": round(precip_7d, 1),
        "uv_index_max": uv_max,
        "rainfall_exposure": rainfall_exposure,
        "solar_exposure": solar_exposure,
        "advisories": advisories,
        "source": "open-meteo",
    }


# --------------------------------------------------------------------------- #
# Explainable buildability score
# --------------------------------------------------------------------------- #
def _slope_score(slope_deg: float) -> tuple[int, str]:
    if slope_deg <= 5:
        return 100, f"✓ Low slope {slope_deg:.1f}° — minimal earthworks"
    if slope_deg <= 10:
        return 78, f"✓ Gentle slope {slope_deg:.1f}° — standard cut/fill"
    if slope_deg <= 20:
        return 45, f"⚠ Moderate slope {slope_deg:.1f}° — retaining walls likely"
    return 15, f"⚠ Steep slope {slope_deg:.1f}° — significant geotechnical work"


def _flood_score(flood: dict[str, Any]) -> tuple[int, str]:
    occ = flood["water_occurrence_pct"]
    band = flood["risk_band"]
    if band == "Low":
        return 100, f"✓ {occ:.0f}% historical surface-water occurrence — low flood risk"
    if band == "Moderate":
        return 55, f"⚠ {occ:.0f}% historical surface-water occurrence — moderate flood risk"
    return 12, f"⚠ {occ:.0f}% historical surface-water occurrence — flood-zone, mitigation mandatory"


def _terrain_score(terrain: dict[str, Any]) -> tuple[int, str]:
    suitability = terrain["suitability"]
    name = terrain["worldcover_class"]
    table = {
        "High suitability": (100, f"✓ {name} — high buildability, minimal clearance"),
        "Minor clearance": (80, f"✓ {name} — light clearance"),
        "Site clearance penalty": (60, f"⚠ {name} — site clearance / tree felling cost"),
        "Excavation penalty": (45, f"⚠ {name} — rock excavation cost"),
        "Existing development": (55, f"⚠ {name} — demolition may be required"),
        "Flood-prone": (25, f"⚠ {name} — high water table"),
        "Protected / flood-prone": (10, f"⚠ {name} — likely protected zone"),
        "Unsuitable": (0, f"⚠ {name} — not buildable"),
    }
    return table.get(suitability, (50, f"{name} — unclassified terrain"))


def _setback_score(lot_area: Optional[float], build_area: Optional[float]) -> tuple[int, str]:
    if not lot_area or not build_area or lot_area <= 0:
        return 70, "• Setback & size feasibility not evaluated (no calibrated boundary)"
    coverage = build_area / lot_area
    perches = lot_area / 25.2929
    if coverage >= 0.45 and perches >= 6:
        return 100, f"✓ {perches:.1f} perches with a {coverage*100:.0f}% buildable envelope"
    if coverage >= 0.30:
        return 70, f"✓ {perches:.1f} perches — {coverage*100:.0f}% buildable after setbacks"
    if coverage >= 0.15:
        return 40, f"⚠ Tight lot — only {coverage*100:.0f}% buildable after UDA setbacks"
    return 15, f"⚠ Very tight lot — {coverage*100:.0f}% buildable after setbacks"


def _weather_score(weather: dict[str, Any]) -> tuple[int, str]:
    rain = weather["rainfall_exposure"]
    if rain == "Low":
        return 100, "✓ Low rainfall exposure — standard drainage sufficient"
    if rain == "Moderate":
        return 65, "⚠ Moderate rainfall — provide graded site drainage"
    if rain == "High":
        return 30, "⚠ High monsoon precipitation — specialised perimeter drainage required"
    return 60, "• Rainfall exposure unknown — assume moderate drainage provision"


def _rating(score: int) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 55:
        return "Moderate"
    if score >= 40:
        return "Marginal"
    return "Poor"


def score_site(
    topography: dict[str, Any],
    terrain: dict[str, Any],
    flood: dict[str, Any],
    weather: dict[str, Any],
    lot_area_sqm: Optional[float] = None,
    build_zone_area_sqm: Optional[float] = None,
) -> dict[str, Any]:
    slope_s, slope_r = _slope_score(topography["slope_deg"])
    flood_s, flood_r = _flood_score(flood)
    terrain_s, terrain_r = _terrain_score(terrain)
    setback_s, setback_r = _setback_score(lot_area_sqm, build_zone_area_sqm)
    weather_s, weather_r = _weather_score(weather)

    factors = [
        {"key": "slope", "label": "Slope", "weight_pct": 35, "factor_score": slope_s, "reason": slope_r},
        {"key": "flood", "label": "Flood risk", "weight_pct": 25, "factor_score": flood_s, "reason": flood_r},
        {"key": "terrain", "label": "Terrain type", "weight_pct": 15, "factor_score": terrain_s, "reason": terrain_r},
        {"key": "setback", "label": "Setback & size feasibility", "weight_pct": 15, "factor_score": setback_s, "reason": setback_r},
        {"key": "weather", "label": "Weather risk", "weight_pct": 10, "factor_score": weather_s, "reason": weather_r},
    ]
    total = round(sum(f["factor_score"] * f["weight_pct"] for f in factors) / 100)
    total = max(0, min(100, total))

    return {
        "buildability_score": total,
        "rating": _rating(total),
        "factors": factors,
        "reasons": [f["reason"] for f in factors] + list(weather.get("advisories", [])),
    }


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def analyze_site(
    lat: float,
    lon: float,
    lot_area_sqm: Optional[float] = None,
    build_zone_area_sqm: Optional[float] = None,
) -> dict[str, Any]:
    ee = _ee()
    if ee is not None:
        try:
            topography = _topography_gee(ee, lat, lon)
            terrain = _terrain_gee(ee, lat, lon)
            flood = _flood_gee(ee, lat, lon)
        except Exception as exc:  # pragma: no cover
            logger.warning("GEE query failed mid-flight (%s) — synthetic fallback", exc)
            topography = _topography_synthetic(lat, lon)
            terrain = _terrain_synthetic(lat, lon)
            flood = _flood_synthetic(lat, lon)
    else:
        topography = _topography_synthetic(lat, lon)
        terrain = _terrain_synthetic(lat, lon)
        flood = _flood_synthetic(lat, lon)

    weather = _weather(lat, lon)
    scored = score_site(
        topography, terrain, flood, weather, lot_area_sqm, build_zone_area_sqm
    )

    return {
        "lat": lat,
        "lon": lon,
        "topography": topography,
        "terrain": terrain,
        "flood": flood,
        "weather": weather,
        "generated_at": datetime.now(timezone.utc),
        **scored,
    }
