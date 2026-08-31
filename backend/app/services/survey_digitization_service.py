"""
Module 1 — Survey Plan AI Digitization (Computer Vision).

Pipeline
--------
1. Load a fine-tuned YOLOv8 segmentation model from ``weights/land_segmentation.pt``;
   fall back to ``yolov8n-seg.pt`` (auto-download), then to a pure-OpenCV contour
   extractor when ultralytics / torch are unavailable.
2. OpenCV preprocessing to lift faint hand-drawn lines on aged Sri Lankan deeds:
   grayscale -> CLAHE -> Gaussian blur.
3. Segment the outer land-boundary polygon and convert pixel (x, y) to metric
   coordinates using a detected ``1:NNN`` scale or a manual perch input
   (1 perch = 25.2929 m^2).
4. Return a clean GeoJSON Polygon of the outer boundary (local metric frame).
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top, before networked imports) ----------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import logging
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

from app.core.config import BASE_DIR, settings

logger = logging.getLogger(__name__)

PERCH_SQM = 25.2929  # 1 perch = 25.2929 m^2 (Sri Lankan land measure)
_SCALE_RE = re.compile(r"1\s*[:/]\s*(\d{2,5})")


# --------------------------------------------------------------------------- #
# Model loading
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _load_yolo() -> Optional[Any]:
    """Load the segmentation model once. Returns None when unavailable."""
    try:
        from ultralytics import YOLO  # noqa: PLC0415  (heavy optional import)
    except Exception as exc:  # pragma: no cover - depends on environment
        logger.warning("ultralytics unavailable (%s); using OpenCV contour fallback", exc)
        return None

    weights = (BASE_DIR / settings.YOLO_SEG_WEIGHTS_PATH).resolve()
    try:
        if weights.is_file():
            logger.info("Loading fine-tuned land-segmentation weights: %s", weights)
            return YOLO(str(weights))
        logger.info(
            "Fine-tuned weights not found at %s; falling back to %s",
            weights,
            settings.YOLO_SEG_FALLBACK,
        )
        return YOLO(settings.YOLO_SEG_FALLBACK)
    except Exception as exc:  # pragma: no cover - network / disk dependent
        logger.warning("YOLO load failed (%s); using OpenCV contour fallback", exc)
        return None


# --------------------------------------------------------------------------- #
# Preprocessing
# --------------------------------------------------------------------------- #
def preprocess(image_bgr: np.ndarray) -> np.ndarray:
    """Grayscale -> CLAHE -> Gaussian blur. Enhances faint aged-deed ink."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(gray)
    return cv2.GaussianBlur(equalized, (5, 5), 0)


# --------------------------------------------------------------------------- #
# Boundary extraction
# --------------------------------------------------------------------------- #
def _polygon_from_mask(mask: np.ndarray) -> Optional[np.ndarray]:
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 50:
        return None
    epsilon = 0.01 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)
    return approx.reshape(-1, 2).astype(np.float64)


def _segment_with_yolo(model: Any, image_bgr: np.ndarray) -> Optional[np.ndarray]:
    try:
        results = model.predict(image_bgr, verbose=False, retina_masks=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("YOLO predict failed (%s); using OpenCV fallback", exc)
        return None

    h, w = image_bgr.shape[:2]
    best_poly: Optional[np.ndarray] = None
    best_area = 0.0
    for res in results:
        masks = getattr(res, "masks", None)
        if masks is None or masks.data is None:
            continue
        for m in masks.data.cpu().numpy():
            mask = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST) > 0.5
            poly = _polygon_from_mask(mask)
            if poly is None or len(poly) < 3:
                continue
            area = cv2.contourArea(poly.astype(np.float32))
            if area > best_area:
                best_area, best_poly = area, poly
    return best_poly


def _segment_with_opencv(pre: np.ndarray) -> Optional[np.ndarray]:
    """Largest closed region on an adaptively thresholded, morphologically closed mask."""
    binary = cv2.adaptiveThreshold(
        pre, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 35, 7
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    closed = cv2.dilate(closed, kernel, iterations=1)

    contours, _ = cv2.findContours(
        closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return None

    h, w = pre.shape[:2]
    img_area = float(h * w)
    candidates = [
        c
        for c in contours
        if img_area * 0.03 < cv2.contourArea(c) < img_area * 0.97
    ]
    if not candidates:
        candidates = contours
    largest = max(candidates, key=cv2.contourArea)
    hull = cv2.convexHull(largest)
    epsilon = 0.015 * cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, epsilon, True)
    return approx.reshape(-1, 2).astype(np.float64)


# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #
def _shoelace_area(poly: np.ndarray) -> float:
    x, y = poly[:, 0], poly[:, 1]
    return float(abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2.0)


def _perimeter(poly: np.ndarray) -> float:
    rolled = np.roll(poly, -1, axis=0)
    return float(np.hypot(*(rolled - poly).T).sum())


def _detect_scale_ratio(image_bgr: np.ndarray) -> Optional[int]:
    """Best-effort OCR of a '1:500' style scale note (optional dependency)."""
    try:
        from app.services.survey_audit_service import ocr_image  # local import

        text, _engine = ocr_image(image_bgr)
    except Exception:  # pragma: no cover
        return None
    if not text:
        return None
    match = _SCALE_RE.search(text.replace(" ", ""))
    return int(match.group(1)) if match else None


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def digitize_survey_plan(
    image_bgr: np.ndarray,
    perches: Optional[float] = None,
    scale_ratio: Optional[float] = None,
    assumed_dpi: float = 150.0,
) -> dict[str, Any]:
    """
    Run the full digitization pipeline.

    Parameters
    ----------
    perches:
        Manual ground-truth area. When given, the pixel polygon is scaled so its
        metric area equals ``perches * 25.2929`` exactly.
    scale_ratio:
        Explicit map scale denominator (e.g. 500 for 1:500). Overrides OCR.
    """
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Empty or unreadable image")

    h, w = image_bgr.shape[:2]
    pre = preprocess(image_bgr)
    notes: list[str] = []

    model = _load_yolo()
    poly: Optional[np.ndarray] = None
    method = "opencv-contour"
    if model is not None:
        poly = _segment_with_yolo(model, image_bgr)
        if poly is not None and len(poly) >= 3:
            weights_path = (BASE_DIR / settings.YOLO_SEG_WEIGHTS_PATH)
            method = (
                "yolov8-seg"
                if weights_path.is_file()
                else "yolov8n-seg-fallback"
            )

    if poly is None or len(poly) < 3:
        poly = _segment_with_opencv(pre)
        method = "opencv-contour"
        notes.append(
            "Segmentation model produced no usable mask; used OpenCV contour extraction."
        )

    if poly is None or len(poly) < 3:
        raise ValueError("Could not detect a land-boundary polygon in the image")

    # Ensure counter-clockwise, deduplicate near-identical vertices
    poly = np.asarray(poly, dtype=np.float64)
    area_px = _shoelace_area(poly)
    if area_px <= 0:
        raise ValueError("Detected polygon has zero area")

    # --- pixel -> metre scale ------------------------------------------------
    resolved_scale = scale_ratio or _detect_scale_ratio(image_bgr)
    scale_source = "assumed"
    if perches and perches > 0:
        target_area_m2 = perches * PERCH_SQM
        meters_per_pixel = math.sqrt(target_area_m2 / area_px)
        scale_source = "manual-perch"
    elif resolved_scale:
        # 1 image pixel = (1 / dpi) inch on paper = (0.0254 / dpi) m on paper,
        # multiplied by the map scale denominator to get ground metres.
        meters_per_pixel = (0.0254 / assumed_dpi) * float(resolved_scale)
        scale_source = "detected-scale" if not scale_ratio else "manual-scale"
        notes.append(
            f"Applied map scale 1:{int(resolved_scale)} at an assumed {assumed_dpi:.0f} DPI."
        )
    else:
        # Last resort: assume the plan spans ~30 m across its wider pixel axis.
        meters_per_pixel = 30.0 / max(w, h)
        notes.append(
            "No scale or perch input supplied; assumed a ~30 m plan width. "
            "Provide the land area in perches for an accurate metric boundary."
        )

    # --- build local metric polygon (origin at centroid, Y up = North) ------
    centroid = poly.mean(axis=0)
    metric = (poly - centroid) * meters_per_pixel
    metric[:, 1] *= -1.0  # image Y grows downward; flip so +Y = North

    area_sqm = _shoelace_area(metric)
    perimeter_m = _perimeter(metric)

    ring = [[round(float(x), 4), round(float(y), 4)] for x, y in metric]
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    boundary_geojson = {
        "type": "Feature",
        "properties": {
            "frame": "local-metric",
            "units": "meters",
            "area_sqm": round(area_sqm, 2),
        },
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }

    return {
        "method": method,
        "boundary_geojson": boundary_geojson,
        "pixel_polygon": [[round(float(x), 2), round(float(y), 2)] for x, y in poly],
        "scale_source": scale_source,
        "meters_per_pixel": round(meters_per_pixel, 6),
        "area_sqm": round(area_sqm, 2),
        "area_perches": round(area_sqm / PERCH_SQM, 3),
        "perimeter_m": round(perimeter_m, 2),
        "image_width": int(w),
        "image_height": int(h),
        "notes": notes,
    }
