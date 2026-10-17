"""
Plan scale resolution — real-world metres per canvas pixel.

Every metric verdict in the architectural audit (room area in m², window-to-floor
ratio, minimum room width, wall thickness -> LOAD_BEARING) is a function of one
number: how many metres one pixel of the registered canvas represents. Before
this module that number was two different hardcoded guesses living in two
different functions, so a wall measured 0.23 m by the thickness rule and 0.52 m
by the room-area rule on the same drawing.

Scale is now resolved **once** per plan, by the strongest available evidence:

    1. ``DIMENSION_OCR``   — read dimension strings off the drawing, pair each
                             with the dimension line it annotates, and take the
                             consensus px -> m ratio.
    2. ``USER_SPAN``       — the operator states the overall span of the plan in
                             metres; exact, and always available as a fallback.
    3. ``ASSUMED_DEFAULT`` — the legacy "every house is 18 m wide" guess, kept so
                             the pipeline still returns something, but reported
                             with ``confidence = 0.0`` so a consumer can refuse
                             to present the metric verdicts as measurements.

The resolution is returned as a :class:`ScaleResolution` carrying its own
provenance, so the API response, the UI and any evaluation run can all state
*where the millimetres came from* instead of assuming they are measured.

This module is deliberately a leaf: it imports nothing from ``app`` and so can
be unit-tested against synthetic images without loading the CV pipeline.
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Legacy assumption, retained only as the last-resort fallback.
ASSUMED_PLAN_SPAN_M = 18.0

# Plausibility envelope for a resolved scale. A residential sheet registered to
# a ~1024 px canvas lands around 0.01-0.08 m/px; anything outside this is a
# misread dimension string, not a scale.
MIN_METERS_PER_PIXEL = 0.002
MAX_METERS_PER_PIXEL = 0.30

# A dimension string must annotate a run of at least this many pixels, or the
# text/line pairing is noise.
MIN_DIMENSION_LINE_PX = 30.0
# Dimension text sits within roughly this distance of the line it annotates.
MAX_TEXT_TO_LINE_PX = 70.0

# Dimension lines are drawn thin; masonry is not. Strokes at or above this ink
# width are walls and must never be read as a dimension run.
MAX_DIMENSION_STROKE_PX = 4.0

# Real-world sanity bounds for a single dimension string on a house plan.
MIN_DIMENSION_M = 0.3
MAX_DIMENSION_M = 60.0

_DECIMAL_PATTERN = re.compile(r"^(\d{1,2})[.,](\d{1,3})$")
_INTEGER_PATTERN = re.compile(r"^(\d{2,5})$")
_FEET_INCH_PATTERN = re.compile(r"^(\d{1,2})'\s*-?\s*(\d{1,2})?\"?$")

_FEET_TO_M = 0.3048
_INCH_TO_M = 0.0254


@dataclass(frozen=True)
class ScaleResolution:
    """Metres per canvas pixel, plus where that number came from."""

    meters_per_pixel: float
    source: str  # DIMENSION_OCR | USER_SPAN | ASSUMED_DEFAULT
    confidence: float  # 0.0 (assumed) ... 1.0 (exact)
    detail: str
    samples: int = 0

    @property
    def pixels_per_meter(self) -> float:
        return 1.0 / self.meters_per_pixel if self.meters_per_pixel else 0.0

    @property
    def is_measured(self) -> bool:
        """True when the scale came from the drawing or the operator."""
        return self.source != "ASSUMED_DEFAULT"

    def to_payload(self) -> dict[str, Any]:
        """Serialisable provenance block for the API response."""
        return {
            "meters_per_pixel": round(self.meters_per_pixel, 6),
            "pixels_per_meter": round(self.pixels_per_meter, 2),
            "source": self.source,
            "confidence": round(self.confidence, 2),
            "detail": self.detail,
            "samples": self.samples,
            "is_measured": self.is_measured,
            # A consumer must not present metric findings as measurements when
            # this is false — they are proportional guesses off a fixed span.
            "metrics_trustworthy": self.is_measured,
        }


# ---------------------------------------------------------------------------
# Dimension string parsing
# ---------------------------------------------------------------------------


def parse_dimension_to_meters(token: str) -> float | None:
    """
    Convert one dimension string off a drawing into metres.

    Handles the three conventions that appear on residential sheets: decimal
    metres (3.50), whole millimetres (3500), and imperial feet-inches (12'-6").
    Returns ``None`` for anything that is not a plausible single room or bay
    dimension.
    """
    text = (token or "").strip().replace(" ", "")
    if not text:
        return None

    feet_inch = _FEET_INCH_PATTERN.match(text)
    if feet_inch:
        feet = float(feet_inch.group(1))
        inches = float(feet_inch.group(2) or 0.0)
        meters = feet * _FEET_TO_M + inches * _INCH_TO_M
        return meters if MIN_DIMENSION_M <= meters <= MAX_DIMENSION_M else None

    decimal = _DECIMAL_PATTERN.match(text)
    if decimal:
        meters = float(f"{decimal.group(1)}.{decimal.group(2)}")
        return meters if MIN_DIMENSION_M <= meters <= MAX_DIMENSION_M else None

    integer = _INTEGER_PATTERN.match(text)
    if integer:
        value = float(integer.group(1))
        # A bare 2-5 digit number on a plan is millimetres (3500 = 3.5 m).
        meters = value / 1000.0
        return meters if MIN_DIMENSION_M <= meters <= MAX_DIMENSION_M else None

    return None


# ---------------------------------------------------------------------------
# Dimension line extraction
# ---------------------------------------------------------------------------


def _ink_mask(image: np.ndarray) -> np.ndarray:
    """Binary ink mask (drawn strokes = 255) from a greyscale or BGR plan."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
    )


def _segment_stroke_px(
    ink: np.ndarray, x1: float, y1: float, x2: float, y2: float
) -> float:
    """
    Ink width along a segment, via distance-transform sampling.

    Self-contained twin of the audit's thickness probe — kept local so this
    module stays a leaf and testable on its own.

    The distance map is dilated before sampling. Hough frequently returns a
    segment riding the *edge* of a thick masonry band rather than its medial
    axis, and the raw distance value on an edge pixel is ~1 px — which would
    let a 12 px wall pass as a dimension line. Taking the local maximum within
    ±3 px finds the medial axis of whatever stroke the segment sits on, so a
    band is measured at its true width. The cost is that a dimension line drawn
    within 3 px of masonry reads as thick and is discarded; rejecting an
    ambiguous run is the safe direction for a scale measurement.
    """
    length = float(np.hypot(x2 - x1, y2 - y1))
    if length < 1.0:
        return 0.0
    dist = cv2.distanceTransform((ink > 0).astype(np.uint8), cv2.DIST_L2, 3)
    dist = cv2.dilate(dist, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))
    h, w = ink.shape[:2]
    steps = max(5, int(min(length, 60)))
    radii: list[float] = []
    for i in range(steps + 1):
        t = i / steps
        x = int(round(x1 + (x2 - x1) * t))
        y = int(round(y1 + (y2 - y1) * t))
        if 0 <= x < w and 0 <= y < h:
            radii.append(float(dist[y, x]))
    if not radii:
        return 0.0
    return 2.0 * float(np.median(radii))


def _dimension_line_segments(
    image: np.ndarray,
) -> list[tuple[float, float, float, float]]:
    """
    Long thin runs on the drawing — dimension lines, not masonry.

    The wall extractor rejects these as "ghost walls"; here they are the signal.
    A segment is kept when its measured ink width stays below
    ``MAX_DIMENSION_STROKE_PX``, which is what separates a 1-2 px dimension run
    from a 9 px masonry stroke.
    """
    ink = _ink_mask(image)
    lines = cv2.HoughLinesP(
        ink,
        rho=1,
        theta=math.pi / 180.0,
        threshold=40,
        minLineLength=int(MIN_DIMENSION_LINE_PX),
        maxLineGap=6,
    )
    if lines is None:
        return []

    segments: list[tuple[float, float, float, float]] = []
    # OpenCV 4 returns (N, 1, 4) from HoughLinesP, OpenCV 5 returns (N, 4).
    # Reshaping makes the unpack below correct on both.
    for line in lines.reshape(-1, 4)[:600]:
        x1, y1, x2, y2 = (float(v) for v in line)
        if float(np.hypot(x2 - x1, y2 - y1)) < MIN_DIMENSION_LINE_PX:
            continue
        if _segment_stroke_px(ink, x1, y1, x2, y2) > MAX_DIMENSION_STROKE_PX:
            continue  # masonry, not a dimension run
        segments.append((x1, y1, x2, y2))
    return segments


def _point_to_segment_distance(
    px: float, py: float, x1: float, y1: float, x2: float, y2: float
) -> float:
    """Shortest distance from a point to a finite segment, in pixels."""
    dx, dy = x2 - x1, y2 - y1
    span_sq = dx * dx + dy * dy
    if span_sq < 1e-6:
        return float(np.hypot(px - x1, py - y1))
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / span_sq))
    return float(np.hypot(px - (x1 + t * dx), py - (y1 + t * dy)))


# ---------------------------------------------------------------------------
# OCR pass
# ---------------------------------------------------------------------------


def _ocr_dimension_tokens(image: np.ndarray) -> list[tuple[str, float, float]]:
    """
    Read numeric dimension strings with Tesseract, as ``(text, cx, cy)``.

    OCR is optional, exactly as in the opening-tag pass: a missing Tesseract
    binary degrades the scale source to ``USER_SPAN`` / ``ASSUMED_DEFAULT``
    rather than failing the request.
    """
    try:
        import pytesseract  # type: ignore
        from pytesseract import Output  # type: ignore
    except Exception:
        logger.info("pytesseract unavailable — skipping dimension OCR scale pass")
        return []

    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    scaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    _, binary = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    try:
        data = pytesseract.image_to_data(
            binary,
            output_type=Output.DICT,
            config="--psm 11 -c tessedit_char_whitelist=0123456789.,'-",
        )
    except Exception as exc:  # pragma: no cover - environment dependent
        logger.warning("Dimension OCR failed (%s) — falling back to stated span", exc)
        return []

    tokens: list[tuple[str, float, float]] = []
    for i, raw in enumerate(data.get("text") or []):
        text = str(raw or "").strip()
        if not text:
            continue
        # Map back from the 2x OCR frame to canvas pixels.
        cx = (float(data["left"][i]) + float(data["width"][i]) / 2.0) / 2.0
        cy = (float(data["top"][i]) + float(data["height"][i]) / 2.0) / 2.0
        tokens.append((text, cx, cy))
    return tokens


def _consensus(values: list[float]) -> tuple[float, float]:
    """
    Robust centre of a candidate set, with an agreement score in ``[0, 1]``.

    Dimension strings on one drawing must all imply the *same* scale, so the
    spread of the candidates is the evidence: a tight cluster is a real
    measurement, a scattered one is OCR noise. Uses median + MAD so a handful
    of misreads cannot drag the answer.
    """
    if not values:
        return 0.0, 0.0
    arr = np.asarray(sorted(values), dtype=float)
    median = float(np.median(arr))
    if median <= 0:
        return 0.0, 0.0
    mad = float(np.median(np.abs(arr - median)))
    relative_spread = mad / median
    # Keep only candidates within 15% of the median, then re-centre on those.
    inliers = arr[np.abs(arr - median) <= max(0.15 * median, 1e-9)]
    if inliers.size:
        median = float(np.median(inliers))
    agreement = max(0.0, 1.0 - relative_spread / 0.15)
    coverage = min(1.0, inliers.size / 4.0)  # 4+ agreeing dimensions = full marks
    return median, max(0.0, min(1.0, 0.5 * agreement + 0.5 * coverage))


def resolve_scale_from_dimensions(image: np.ndarray) -> ScaleResolution | None:
    """
    Derive metres-per-pixel by pairing OCR'd dimension strings with the
    dimension lines they annotate.

    For every (text, line) pair close enough to belong together, the ratio
    ``metres / pixel_length`` is one candidate scale. The consensus of those
    candidates is the drawing's scale — independent of print DPI, paper size and
    the plotted ratio in the title block, all of which the 1024² registration
    has already destroyed.
    """
    tokens = _ocr_dimension_tokens(image)
    if not tokens:
        return None
    segments = _dimension_line_segments(image)
    if not segments:
        logger.info(
            "Dimension OCR found %d token(s) but no thin dimension runs", len(tokens)
        )
        return None

    candidates: list[float] = []
    for text, cx, cy in tokens:
        meters = parse_dimension_to_meters(text)
        if meters is None:
            continue
        best: tuple[float, float] | None = None  # (distance, length_px)
        for x1, y1, x2, y2 in segments:
            distance = _point_to_segment_distance(cx, cy, x1, y1, x2, y2)
            if distance > MAX_TEXT_TO_LINE_PX:
                continue
            length_px = float(np.hypot(x2 - x1, y2 - y1))
            if best is None or distance < best[0]:
                best = (distance, length_px)
        if best is None or best[1] < MIN_DIMENSION_LINE_PX:
            continue
        mpp = meters / best[1]
        if MIN_METERS_PER_PIXEL <= mpp <= MAX_METERS_PER_PIXEL:
            candidates.append(mpp)

    if len(candidates) < 2:
        logger.info(
            "Dimension OCR produced %d usable candidate(s) — not enough for consensus",
            len(candidates),
        )
        return None

    mpp, confidence = _consensus(candidates)
    if not (MIN_METERS_PER_PIXEL <= mpp <= MAX_METERS_PER_PIXEL):
        return None

    return ScaleResolution(
        meters_per_pixel=mpp,
        source="DIMENSION_OCR",
        confidence=round(0.4 + 0.6 * confidence, 2),
        detail=(
            f"Consensus of {len(candidates)} dimension string(s) read off the "
            f"drawing ({1.0 / mpp:.1f} px per metre)"
        ),
        samples=len(candidates),
    )


def _footprint_span_px(house_bounds: dict[str, Any] | None, canvas: int) -> float:
    """Longer side of the detected building footprint, in canvas pixels."""
    if house_bounds:
        width = float(house_bounds.get("width") or 0.0)
        height = float(house_bounds.get("height") or 0.0)
        span = max(width, height)
        if span > 1.0:
            return span
    return float(canvas)


def resolve_scale_from_span(
    plan_span_m: float,
    house_bounds: dict[str, Any] | None,
    canvas: int,
) -> ScaleResolution | None:
    """
    Metres per pixel from an operator-stated overall span.

    ``plan_span_m`` is the real-world length of the longer side of the building
    footprint. Exact when stated correctly, so it outranks every heuristic.
    """
    if plan_span_m is None or plan_span_m <= 0:
        return None
    span_px = _footprint_span_px(house_bounds, canvas)
    if span_px <= 1.0:
        return None
    mpp = float(plan_span_m) / span_px
    if not (MIN_METERS_PER_PIXEL <= mpp <= MAX_METERS_PER_PIXEL):
        logger.warning(
            "Stated span %.2f m over %.0f px gives an implausible scale (%.4f m/px)",
            plan_span_m,
            span_px,
            mpp,
        )
        return None
    return ScaleResolution(
        meters_per_pixel=mpp,
        source="USER_SPAN",
        confidence=1.0,
        detail=(
            f"Operator-stated footprint span of {float(plan_span_m):.2f} m "
            f"across {span_px:.0f} px"
        ),
        samples=1,
    )


def assumed_scale(
    house_bounds: dict[str, Any] | None, canvas: int
) -> ScaleResolution:
    """
    The legacy fallback: assume the footprint spans ``ASSUMED_PLAN_SPAN_M``.

    Reported with ``confidence = 0.0`` and ``is_measured = False``. Metric
    findings derived from this are proportional, not measured, and must be
    labelled as such wherever they surface.
    """
    span_px = _footprint_span_px(house_bounds, canvas)
    mpp = ASSUMED_PLAN_SPAN_M / span_px
    return ScaleResolution(
        meters_per_pixel=mpp,
        source="ASSUMED_DEFAULT",
        confidence=0.0,
        detail=(
            f"No scale evidence on the drawing — assumed a "
            f"{ASSUMED_PLAN_SPAN_M:.0f} m footprint span across {span_px:.0f} px. "
            f"Metric verdicts are indicative only."
        ),
        samples=0,
    )


def resolve_scale(
    arch_image: np.ndarray,
    house_bounds: dict[str, Any] | None = None,
    canvas: int = 1024,
    plan_span_m: float | None = None,
) -> ScaleResolution:
    """
    Resolve the drawing's scale once, by the strongest available evidence.

    Priority: operator-stated span -> dimension OCR consensus -> legacy
    assumption. The returned value is the single metres-per-pixel used by every
    downstream metric, which is what keeps wall thickness and room area on the
    same ruler.
    """
    stated = (
        resolve_scale_from_span(plan_span_m, house_bounds, canvas)
        if plan_span_m
        else None
    )
    if stated is not None:
        logger.info("Scale: %s (%.5f m/px)", stated.source, stated.meters_per_pixel)
        return stated

    try:
        measured = resolve_scale_from_dimensions(arch_image)
    except Exception as exc:  # pragma: no cover - OCR/CV environment dependent
        logger.warning("Dimension scale pass errored (%s) — falling back", exc)
        measured = None
    if measured is not None:
        logger.info("Scale: %s (%.5f m/px)", measured.source, measured.meters_per_pixel)
        return measured

    fallback = assumed_scale(house_bounds, canvas)
    logger.warning(
        "Scale could not be measured — using %s (%.5f m/px). Metric audit "
        "findings are indicative only.",
        fallback.source,
        fallback.meters_per_pixel,
    )
    return fallback
