"""
Component 2 — Hybrid Architectural Validation Pipeline
======================================================

1. YOLOv8 detects doors / windows / openings on the architectural plan.
2. Adaptive-threshold OpenCV extracts exterior + interior wall centreline
   segments from scanned paper blueprints (contour + room-poly + Hough).
3. Classic OpenCV (threshold + contours) extracts solid column symbols
   from the structural plan.
4. Both canvases are registered to a shared 1024×1024 coordinate frame.
5. Bounding-box overlap (IoU / intersection ratio) flags geometric clashes.
"""

from __future__ import annotations

import logging
import math
import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# backend/ root (app/services → app → backend)
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
YOLO_WEIGHTS_PATH = BACKEND_ROOT / "app" / "models" / "yolov8_architect.pt"

# Shared registration canvas — both plans are resized here before detection.
CANVAS_SIZE = 1024  # width = height = 1024 px

OPENING_CLASS_NAMES = {
    "door",
    "doors",
    "window",
    "windows",
    "opening",
    "openings",
}

# YOLOv8 inference — balanced for scanned symbol detection (doors D1–D4, windows W*).
YOLO_CONF_THRESHOLD = 0.28

# Overlap thresholds (intersection / smaller-box area).
OVERLAP_CRITICAL = 0.30  # major blockage → CRITICAL
OVERLAP_WARNING = 0.08  # glancing contact → WARNING

# Column contour filters (relative to 1024² canvas area).
MIN_COLUMN_AREA_RATIO = 0.0006
MAX_COLUMN_AREA_RATIO = 0.06
MIN_COLUMN_ASPECT = 0.45
MAX_COLUMN_ASPECT = 2.2

# Boolean wall↔opening subtraction: gap slightly wider than the YOLO box so the
# 3D masonry never Z-fights the framed door / window mesh.
OPENING_CUT_PAD_PX = 8.0
# Discard wall stubs shorter than this after a cut (noise / rounding).
MIN_WALL_REMNANT_PX = 18.0

# Scanned blueprint wall extractor — nominal masonry stroke on the 1024² canvas.
WALL_SEGMENT_THICKNESS_PX = 9.0
HOUGH_WALL_THICKNESS_PX = WALL_SEGMENT_THICKNESS_PX  # legacy alias
ROOM_MIN_AREA_PX = 1200
ROOM_POLYGON_EPSILON_RATIO = 0.015
ROOM_THRESHOLD_VALUE = 200  # legacy fixed-threshold fallback
ADAPTIVE_BLOCK_SIZE = 21
ADAPTIVE_C = 10
HOUGH_MIN_LINE_LENGTH = 40
HOUGH_MAX_LINE_GAP = 14
HOUGH_THRESHOLD = 40
MIN_WALL_SEGMENT_LENGTH_PX = 28.0
LOAD_BEARING_THICKNESS_M = 0.23
COLUMN_ALIGN_PAD_PX = 28.0

# Drawing-sheet border rejection. A scanned plan has a printed frame around the
# paper; extracted as a wall it dwarfs the house and drags the centroid off, so
# anything living entirely inside a margin band is discarded.
SHEET_MARGIN_RATIO = 0.06
# A contour tracing the sheet frame spans nearly the whole image perimeter.
SHEET_BORDER_PERIMETER_RATIO = 0.85

# Orthogonal grid enforcement. Floor plans are drawn on a rectangular grid, so
# Residential plans are strictly orthogonal — anything outside this snaps to 0°/90°
# or is discarded as a dimension line, hatch stroke, or minAreaRect artifact.
ORTHO_SNAP_TOL_DEG = 5.0
# Parallel walls whose centrelines land this close share one grid line.
GRID_SNAP_TOL_PX = 15.0
# Wall endpoints within this distance weld to a crossing wall's line.
CORNER_WELD_TOL_PX = 15.0
# CAD double-line walls: inner + outer face strokes spaced within this band merge
# to a single centreline (never two overlapping 3D meshes for one wall).
DOUBLE_WALL_MIN_GAP_PX = 5.0
DOUBLE_WALL_MAX_GAP_PX = 25.0
DOUBLE_WALL_MIN_OVERLAP_PX = 18.0
# Largest hole bridged between two collinear walls. Sized to span doorways and
# short ink dropouts while staying well under the mouth of a car porch or
# veranda, so an intentionally open bay is never walled shut and a concave
# (L-shaped) footprint survives instead of being squared into a box.
BRIDGE_GAP_TOL_PX = 52.0
# Strokes thinner than this are dimension / grid / text, not masonry. A long
# dimension line that shares a grid with a real wall must never extend that
# wall across a car porch.
DIMENSION_MAX_THICKNESS_PX = 5.0

# Wall consolidation — collapse fragmented strokes into solid centrelines.
# Hand-drawn plans yield dozens of duplicate parallel strokes from hatching,
# dimension lines and text; a house should resolve to ~12–28 real walls.
MIN_WALL_LENGTH_PX = 25.0
COLLINEAR_ANGLE_TOL_DEG = 8.0
COLLINEAR_OFFSET_TOL_PX = 14.0
SPAN_MERGE_GAP_PX = 26.0
MAX_CONSOLIDATED_WALLS = 72

# Hand-drawn opening symbols: doors tagged D1..Dn, windows tagged W1..Wn.
OPENING_TAG_PATTERN = re.compile(r"([DW])\s*(\d{1,2})", re.IGNORECASE)
# Nominal opening footprint (px on the 1024² canvas) when synthesized from tags.
DOOR_SYMBOL_SIZE_PX = 46.0
WINDOW_SYMBOL_SIZE_PX = 54.0
# A tag must sit within this distance of a wall centreline to bind to it.
TAG_TO_WALL_SNAP_PX = 90.0
# Perimeter gap classification: shorter gaps read as doors, longer as windows.
GAP_MIN_PX = 26.0
GAP_MAX_PX = 190.0
GAP_DOOR_MAX_PX = 95.0
# Exterior vs interior wall classification for opening typing.
PERIMETER_WALL_TOL_PX = 14.0
# Door swing arcs on CAD plans — search radius around each opening centre.
SWING_ARC_SEARCH_RADIUS_PX = 80.0
SWING_ARC_MIN_CURVATURE = 1.22
# Staircase tread lines: parallel strokes closer than this are hatching, not walls.
STAIR_STEP_MAX_SPACING_PX = 15.0
STAIR_MIN_STEP_LINES = 4
# Non-maximum suppression radius for duplicate door/window detections at one opening.
OPENING_NMS_RADIUS_PX = 40.0


@dataclass(frozen=True)
class BoundingBox:
    """Axis-aligned box in absolute pixel coordinates [xmin, ymin, xmax, ymax]."""

    xmin: float
    ymin: float
    xmax: float
    ymax: float

    @property
    def width(self) -> float:
        return max(0.0, self.xmax - self.xmin)

    @property
    def height(self) -> float:
        return max(0.0, self.ymax - self.ymin)

    @property
    def area(self) -> float:
        return self.width * self.height

    def as_xyxy(self) -> list[float]:
        return [
            round(self.xmin, 2),
            round(self.ymin, 2),
            round(self.xmax, 2),
            round(self.ymax, 2),
        ]

    def clip(self, img_w: int, img_h: int) -> "BoundingBox":
        return BoundingBox(
            xmin=float(np.clip(self.xmin, 0, img_w)),
            ymin=float(np.clip(self.ymin, 0, img_h)),
            xmax=float(np.clip(self.xmax, 0, img_w)),
            ymax=float(np.clip(self.ymax, 0, img_h)),
        )

    def intersection(self, other: "BoundingBox") -> "BoundingBox | None":
        ix1 = max(self.xmin, other.xmin)
        iy1 = max(self.ymin, other.ymin)
        ix2 = min(self.xmax, other.xmax)
        iy2 = min(self.ymax, other.ymax)
        if ix2 <= ix1 or iy2 <= iy1:
            return None
        return BoundingBox(ix1, iy1, ix2, iy2)

    def shifted(self, dx: float, dy: float) -> "BoundingBox":
        """Return a copy translated by ``(dx, dy)`` pixels."""
        return BoundingBox(
            self.xmin + dx,
            self.ymin + dy,
            self.xmax + dx,
            self.ymax + dy,
        )


@dataclass
class Detection:
    id: str
    label: str
    confidence: float
    box: BoundingBox
    source: str  # "architectural" | "structural"


# ---------------------------------------------------------------------------
# Image I/O & registration
# ---------------------------------------------------------------------------


def _load_image(path: str | Path) -> np.ndarray:
    """
    Load a blueprint from disk (PNG/JPG/TIFF or first page of a PDF).
    Returns a BGR uint8 ndarray.
    """
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise RuntimeError(
                "PDF support requires pymupdf. Install with: pip install pymupdf"
            ) from exc

        doc = fitz.open(path)
        if doc.page_count < 1:
            raise ValueError(f"PDF has no pages: {path}")
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
            pix.height, pix.width, pix.n
        )
        if pix.n == 3:
            return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        if pix.n == 4:
            return cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        return img

    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Unable to read image file: {path}")
    return image


def align_to_canvas(
    image: np.ndarray,
    size: int = CANVAS_SIZE,
) -> np.ndarray:
    """
    Image-registration helper: resize any blueprint to a square ``size×size``
    canvas so architectural and structural detections share one coordinate system.
    """
    return cv2.resize(image, (size, size), interpolation=cv2.INTER_AREA)


def _box_to_percent(box: BoundingBox, img_w: int, img_h: int) -> dict[str, str]:
    """CSS-percentage box for the Next.js inspection canvas."""
    return {
        "top": f"{(box.ymin / img_h) * 100:.2f}%",
        "left": f"{(box.xmin / img_w) * 100:.2f}%",
        "width": f"{(box.width / img_w) * 100:.2f}%",
        "height": f"{(box.height / img_h) * 100:.2f}%",
    }


def _detection_payload(det: Detection, canvas: int = CANVAS_SIZE) -> dict[str, Any]:
    """Serialize a detection with both absolute xyxy and UI percentages."""
    perc = _box_to_percent(det.box, canvas, canvas)
    return {
        "id": det.id,
        "label": det.label,
        "confidence": det.confidence,
        "bbox": det.box.as_xyxy(),  # [xmin, ymin, xmax, ymax]
        "top": perc["top"],
        "left": perc["left"],
        "width": perc["width"],
        "height": perc["height"],
        "source": det.source,
    }


def _axis_centerline(box: BoundingBox) -> tuple[float, float, float, float]:
    """Centreline along the long axis of an axis-aligned wall box."""
    if box.width >= box.height:
        cy = box.ymin + box.height / 2.0
        return (box.xmin, cy, box.xmax, cy)
    cx = box.xmin + box.width / 2.0
    return (cx, box.ymin, cx, box.ymax)


def _clip_segment_to_box(
    seg: tuple[float, float, float, float],
    box: BoundingBox,
) -> tuple[float, float, float, float] | None:
    """
    Liang–Barsky clip of a wall centreline against a remnant box.

    Splitting a wall around an opening shortens it; clipping the original
    segment (rather than re-deriving from the remnant AABB) preserves the
    bearing of diagonal walls.
    """
    x1, y1, x2, y2 = seg
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in (
        (-dx, x1 - box.xmin),
        (dx, box.xmax - x1),
        (-dy, y1 - box.ymin),
        (dy, box.ymax - y1),
    ):
        if abs(p) < 1e-9:
            if q < 0:
                return None  # parallel to this edge and outside it
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
    if t0 > t1:
        return None
    return (x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy)


def _wall_dict_from_box(
    template: dict[str, Any],
    box: BoundingBox,
    canvas: int,
) -> dict[str, Any]:
    """Clone wall metadata onto a (possibly split) AABB."""
    perc = _box_to_percent(box, canvas, canvas)
    thickness_px = float(min(box.width, box.height))
    prior_px = float(template.get("thickness_px") or thickness_px)
    # Remnant short-side can be the wall length after a bad split — keep prior
    if thickness_px > prior_px * 1.5 and prior_px > 0:
        thickness_px = prior_px
    thickness_m = float(template.get("thickness_m") or (thickness_px / 100.0))

    prior_seg = None
    if all(k in template for k in ("x1", "y1", "x2", "y2")):
        prior_seg = (
            float(template["x1"]),
            float(template["y1"]),
            float(template["x2"]),
            float(template["y2"]),
        )
    seg = _clip_segment_to_box(prior_seg, box) if prior_seg else None
    if seg is None or math.hypot(seg[2] - seg[0], seg[3] - seg[1]) < 1.0:
        seg = _axis_centerline(box)

    return {
        "id": template.get("id", "WALL"),
        "label": template.get("label", "Wall"),
        "confidence": template.get("confidence", 70.0),
        "bbox": box.as_xyxy(),
        "top": perc["top"],
        "left": perc["left"],
        "width": perc["width"],
        "height": perc["height"],
        "source": template.get("source", "architectural"),
        "kind": "wall",
        "wall_type": template.get("wall_type", "PARTITION"),
        "thickness_m": round(thickness_m, 3),
        "thickness_px": round(thickness_px, 1),
        "aligns_with_column": bool(template.get("aligns_with_column", False)),
        "orientation": "horizontal" if box.width >= box.height else "vertical",
        "x1": round(seg[0], 2),
        "y1": round(seg[1], 2),
        "x2": round(seg[2], 2),
        "y2": round(seg[3], 2),
    }


def subtract_openings_from_walls(
    walls: list[dict[str, Any]],
    openings: list[Detection],
    canvas: int = CANVAS_SIZE,
    gap_pad_px: float = OPENING_CUT_PAD_PX,
) -> list[dict[str, Any]]:
    """
    Split any wall AABB that crosses a door/window into remnants that leave a
    physical gap at the opening (boolean subtraction on the plan).

    The gap is expanded by ``gap_pad_px`` beyond the YOLO box so extruded wall
    meshes never collide with framed openings in the 3D viewport.
    """
    if not walls or not openings:
        return walls

    labeled = [
        o
        for o in openings
        if any(
            token in (o.label or "").lower()
            for token in ("door", "window", "opening")
        )
    ]
    # YOLO openings are already door/window/opening; fall back to the full set
    targets = labeled if labeled else openings

    result: list[dict[str, Any]] = []
    cuts = 0

    for wall in walls:
        bbox = wall.get("bbox") or []
        if len(bbox) < 4:
            result.append(wall)
            continue

        segments = [
            BoundingBox(
                float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
            )
        ]
        horizontal = float(bbox[2] - bbox[0]) >= float(bbox[3] - bbox[1])

        for opening in targets:
            gap = BoundingBox(
                opening.box.xmin - gap_pad_px,
                opening.box.ymin - gap_pad_px,
                opening.box.xmax + gap_pad_px,
                opening.box.ymax + gap_pad_px,
            ).clip(canvas, canvas)

            next_segments: list[BoundingBox] = []
            for seg in segments:
                inter = seg.intersection(gap)
                if inter is None:
                    next_segments.append(seg)
                    continue

                # Require a meaningful bite along the wall run (not a glancing touch)
                if horizontal:
                    if inter.width < 4.0:
                        next_segments.append(seg)
                        continue
                    left = BoundingBox(seg.xmin, seg.ymin, inter.xmin, seg.ymax)
                    right = BoundingBox(inter.xmax, seg.ymin, seg.xmax, seg.ymax)
                    if left.width >= MIN_WALL_REMNANT_PX:
                        next_segments.append(left)
                    if right.width >= MIN_WALL_REMNANT_PX:
                        next_segments.append(right)
                    cuts += 1
                else:
                    if inter.height < 4.0:
                        next_segments.append(seg)
                        continue
                    top = BoundingBox(seg.xmin, seg.ymin, seg.xmax, inter.ymin)
                    bottom = BoundingBox(seg.xmin, inter.ymax, seg.xmax, seg.ymax)
                    if top.height >= MIN_WALL_REMNANT_PX:
                        next_segments.append(top)
                    if bottom.height >= MIN_WALL_REMNANT_PX:
                        next_segments.append(bottom)
                    cuts += 1

            segments = next_segments
            if not segments:
                break

        for seg in segments:
            result.append(_wall_dict_from_box(wall, seg, canvas))

    for i, item in enumerate(result, start=1):
        item["id"] = f"WALL-{i:02d}"
        base = (
            "Load-Bearing"
            if item.get("wall_type") == "LOAD_BEARING"
            else "Partition"
        )
        item["label"] = f"{base} Wall {i}"

    if cuts:
        logger.info(
            "Cut %d wall/opening intersection(s); %d wall segment(s) remain",
            cuts,
            len(result),
        )
    return result


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def compute_iou(a: BoundingBox, b: BoundingBox) -> float:
    """Intersection-over-Union for two axis-aligned boxes."""
    inter = a.intersection(b)
    if inter is None:
        return 0.0
    union = a.area + b.area - inter.area
    if union <= 0:
        return 0.0
    return inter.area / union


def compute_overlap_ratio(a: BoundingBox, b: BoundingBox) -> float:
    """
    Intersection area relative to the *smaller* box.

    More sensitive than IoU when a thin door opening is pierced by a thick column.
    """
    inter = a.intersection(b)
    if inter is None:
        return 0.0
    smaller = min(a.area, b.area)
    if smaller <= 0:
        return 0.0
    return inter.area / smaller


# Strict clearance padding (px) so post-shift overlap is exactly 0.0.
CLEARANCE_EPS_PX = 1.0
# Display scale used in GCR prescriptions (100 px ≈ 1.0 m on the registered canvas).
PX_PER_METER = 100.0


def compute_minimal_clearance_shift(
    column: BoundingBox,
    opening: BoundingBox,
    eps: float = CLEARANCE_EPS_PX,
) -> tuple[float, float]:
    """
    Compute the smallest axis-aligned pixel shift that moves ``column``
    completely clear of ``opening`` (cardinal directions only).
    """
    if column.intersection(opening) is None:
        return 0.0, 0.0

    candidates: list[tuple[float, float]] = [
        (opening.xmin - column.xmax - eps, 0.0),  # West (−X)
        (opening.xmax - column.xmin + eps, 0.0),  # East (+X)
        (0.0, opening.ymin - column.ymax - eps),  # North (−Y in image space)
        (0.0, opening.ymax - column.ymin + eps),  # South (+Y)
    ]
    return min(candidates, key=lambda d: abs(d[0]) + abs(d[1]))


def closed_loop_revalidate(
    column: BoundingBox,
    opening: BoundingBox,
    delta_x: float,
    delta_y: float,
) -> tuple[float, float, float, str]:
    """
    AI-Validation Closed-Loop Feedback.

    Temporarily apply the proposed shift, recompute overlap against the
    static opening, and require recalculated overlap == 0.0%.

    Returns ``(final_dx, final_dy, recalculated_overlap, status)``.
    """
    ax, ay = delta_x, delta_y
    for step in range(0, 8):
        scale = 1.0 if step == 0 else 1.0 + 0.5 * step
        tx, ty = ax * scale, ay * scale
        shifted = column.shifted(tx, ty)
        overlap = compute_overlap_ratio(shifted, opening)
        iou = compute_iou(shifted, opening)
        if overlap < 1e-9 and iou < 1e-9:
            return tx, ty, 0.0, "VERIFIED_SAFE"

    shifted = column.shifted(delta_x, delta_y)
    residual = compute_overlap_ratio(shifted, opening)
    return delta_x, delta_y, round(residual, 6), "VERIFICATION_FAILED"


def _direction_label(delta_x: float, delta_y: float) -> str:
    if abs(delta_x) >= abs(delta_y):
        meters = abs(delta_x) / PX_PER_METER
        heading = "West" if delta_x < 0 else "East"
        return f"{meters:.2f} meters {heading} (X: {delta_x:+.0f}px)"
    meters = abs(delta_y) / PX_PER_METER
    heading = "North" if delta_y < 0 else "South"
    return f"{meters:.2f} meters {heading} (Y: {delta_y:+.0f}px)"


def build_verified_gcr_recommendation(
    clash: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    """
    Derive a GCR shift from clash geometry, then mathematically prove
    post-shift overlap is 0.0% (``VERIFIED_SAFE``).
    """
    coords = clash.get("coordinates") or {}
    col_xyxy = coords.get("column_bbox") or []
    open_xyxy = coords.get("opening_bbox") or []

    column_id = str(clash.get("column_id") or "C1")
    opening_id = str(clash.get("opening_id") or "opening")
    column_label = f"Column {column_id}" if not str(column_id).lower().startswith("column") else str(column_id)
    # Prefer human labels from detection ids already formatted as "C2" / "D1"
    if column_id.upper().startswith("C"):
        column_label = f"Column {column_id.upper()}"
    opening_label = opening_id
    if opening_id.upper().startswith("D"):
        opening_label = f"Door {opening_id.upper()}"
    elif opening_id.upper().startswith("W"):
        opening_label = f"Window {opening_id.upper()}"

    initial_overlap = float(clash.get("overlap_ratio") or 0.0)
    clash_key = str(clash.get("clash_id") or clash.get("id") or f"{index:02d}")

    if len(col_xyxy) == 4 and len(open_xyxy) == 4:
        column_box = BoundingBox(
            float(col_xyxy[0]),
            float(col_xyxy[1]),
            float(col_xyxy[2]),
            float(col_xyxy[3]),
        )
        opening_box = BoundingBox(
            float(open_xyxy[0]),
            float(open_xyxy[1]),
            float(open_xyxy[2]),
            float(open_xyxy[3]),
        )
        proposed_dx, proposed_dy = compute_minimal_clearance_shift(
            column_box, opening_box
        )
        delta_x, delta_y, recalculated, status = closed_loop_revalidate(
            column_box, opening_box, proposed_dx, proposed_dy
        )
    else:
        delta_x, delta_y = -120.0, 0.0
        recalculated, status = 1.0, "VERIFICATION_FAILED"

    # Compliance contract: verified recommendations always report 0.0 overlap.
    if status == "VERIFIED_SAFE":
        recalculated = 0.0

    direction = _direction_label(delta_x, delta_y)
    prescription = (
        f"Shift {column_label} by {direction} to clear {opening_label} "
        f"while maintaining structural load balancing."
    )

    verified_pct = recalculated * 100.0
    return {
        "id": f"gcr-{index:02d}",
        "title": f"Resolve {column_label} / {opening_label} overlap.",
        "prescription": prescription,
        "target_detection_id": column_id,
        "delta_x": round(float(delta_x), 2),
        "delta_y": round(float(delta_y), 2),
        "clash_id": clash_key,
        "initial_overlap": round(initial_overlap, 4),
        "recalculated_overlap": 0.0 if status == "VERIFIED_SAFE" else round(recalculated, 4),
        "status": status,
        "verification_log": (
            f"{clash_key} -> Initial Overlap {initial_overlap * 100:.1f}% -> "
            f"AI Shift Suggestion ({delta_x:+.0f}px, {delta_y:+.0f}px) -> "
            f"Recalculated Overlap {verified_pct:.1f}% "
            f"({'Verified' if status == 'VERIFIED_SAFE' else 'Failed'})"
        ),
    }


# ---------------------------------------------------------------------------
# YOLOv8 — architectural openings
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_yolo_model() -> Any:
    """
    Lazily load ``yolov8_architect.pt``.

    Falls back to Ultralytics ``yolov8n.pt`` when custom weights are absent so
    local development remains runnable.
    """
    from ultralytics import YOLO

    if YOLO_WEIGHTS_PATH.is_file():
        logger.info("Loading custom YOLOv8 weights from %s", YOLO_WEIGHTS_PATH)
        return YOLO(str(YOLO_WEIGHTS_PATH))

    logger.warning(
        "Custom weights not found at %s — falling back to yolov8n.pt. "
        "Place your trained model at that path for production accuracy.",
        YOLO_WEIGHTS_PATH,
    )
    return YOLO("yolov8n.pt")


def detect_architectural_openings(arch_image: np.ndarray) -> list[Detection]:
    """
    Run YOLOv8 inference on the (already aligned) architectural blueprint.

    Returns detections with label, confidence (0–100), and [xmin,ymin,xmax,ymax].
    Only boxes at or above ``YOLO_CONF_THRESHOLD`` (28%) are returned.
    """
    model = get_yolo_model()
    results = model.predict(
        source=arch_image, conf=YOLO_CONF_THRESHOLD, verbose=False
    )

    detections: list[Detection] = []
    if not results:
        return detections

    result = results[0]
    names: dict[int, str] = result.names or {}
    boxes = result.boxes
    if boxes is None:
        return detections

    h, w = arch_image.shape[:2]
    custom_model = YOLO_WEIGHTS_PATH.is_file()
    door_idx = 0
    window_idx = 0
    other_idx = 0

    for box in boxes:
        cls_id = int(box.cls.item())
        label = str(names.get(cls_id, f"class_{cls_id}")).lower()

        # COCO fallback has no reliable door/window classes — skip noise.
        if not custom_model and label not in OPENING_CLASS_NAMES:
            continue

        xyxy = box.xyxy[0].tolist()
        conf = float(box.conf.item())
        if conf < YOLO_CONF_THRESHOLD:
            continue
        bb = BoundingBox(xyxy[0], xyxy[1], xyxy[2], xyxy[3]).clip(w, h)
        if bb.area <= 0:
            continue

        if "door" in label:
            door_idx += 1
            display_label = f"Door D{door_idx}"
            det_id = f"D{door_idx}"
        elif "window" in label:
            window_idx += 1
            display_label = f"Window W{window_idx}"
            det_id = f"W{window_idx}"
        else:
            other_idx += 1
            display_label = label.replace("_", " ").title()
            det_id = f"O{other_idx}"

        detections.append(
            Detection(
                id=det_id,
                label=display_label,
                confidence=round(conf * 100, 1),
                box=bb,
                source="architectural",
            )
        )

    if not detections:
        logger.info(
            "YOLOv8 returned no opening detections — using OpenCV heuristic fallback"
        )
        detections = _detect_rectangular_openings(arch_image)

    return detections


def _detect_rectangular_openings(image: np.ndarray) -> list[Detection]:
    """Contour heuristic for door/window candidates when YOLO yields nothing."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    ink = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        21,
        10,
    )
    edges = cv2.Canny(blur, 40, 140)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(cv2.bitwise_or(edges, ink), kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = image.shape[:2]
    img_area = float(h * w)
    detections: list[Detection] = []
    door_idx = 0
    window_idx = 0

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = float(bw * bh)
        if area < img_area * 0.0015 or area > img_area * 0.12:
            continue
        aspect = bw / max(bh, 1)

        if 0.25 <= aspect <= 0.75:
            door_idx += 1
            label, conf, det_id = f"Door D{door_idx}", 62.0, f"D{door_idx}"
        elif 1.15 <= aspect <= 4.5:
            window_idx += 1
            label, conf, det_id = f"Window W{window_idx}", 58.0, f"W{window_idx}"
        else:
            continue

        detections.append(
            Detection(
                id=det_id,
                label=label,
                confidence=conf,
                box=BoundingBox(float(x), float(y), float(x + bw), float(y + bh)),
                source="architectural",
            )
        )

    detections.sort(key=lambda d: d.box.area, reverse=True)
    # Prefer enough symbols for a typical ground-floor set (D1–D4, W1–W5)
    doors = [d for d in detections if d.id.startswith("D")][:4]
    windows = [d for d in detections if d.id.startswith("W")][:5]
    return doors + windows


# ---------------------------------------------------------------------------
# Hand-drawn opening symbols — OCR tags / circle markers / perimeter gaps
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class OpeningTag:
    """A ``D``/``W`` label found on a hand-drawn plan, in canvas pixels."""

    kind: str  # "door" | "window"
    index: int  # 1 for D1 / W1 (0 when unnumbered)
    cx: float
    cy: float
    confidence: float


def _ocr_opening_tags(image: np.ndarray) -> list[OpeningTag]:
    """
    Read ``D1``/``W3`` style tags with Tesseract when it is installed.

    OCR is optional — the circle and gap detectors below cover installs
    without a Tesseract binary, so a missing dependency is not an error.
    """
    try:
        import pytesseract  # type: ignore
        from pytesseract import Output  # type: ignore
    except Exception:
        logger.info("pytesseract unavailable — skipping OCR tag pass")
        return []

    gray = (
        image
        if image.ndim == 2
        else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    )
    # Upscale + binarize: hand-lettered tags are small and low contrast
    scaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    _, binary = cv2.threshold(
        scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    try:
        data = pytesseract.image_to_data(
            binary,
            output_type=Output.DICT,
            config="--psm 11 -c tessedit_char_whitelist=DWdw0123456789",
        )
    except Exception as exc:  # pragma: no cover - environment dependent
        logger.warning("OCR tag pass failed (%s) — continuing without it", exc)
        return []

    tags: list[OpeningTag] = []
    words = data.get("text") or []
    for i, raw in enumerate(words):
        text = str(raw or "").strip()
        if not text:
            continue
        match = OPENING_TAG_PATTERN.search(text.upper())
        if not match:
            continue
        letter, number = match.group(1).upper(), int(match.group(2))
        # Map back from the 2× upscaled OCR frame to canvas pixels
        x = float(data["left"][i]) / 2.0
        y = float(data["top"][i]) / 2.0
        bw = float(data["width"][i]) / 2.0
        bh = float(data["height"][i]) / 2.0
        try:
            conf = float(data.get("conf", [])[i])
        except (IndexError, TypeError, ValueError):
            conf = 60.0
        tags.append(
            OpeningTag(
                kind="door" if letter == "D" else "window",
                index=number,
                cx=x + bw / 2.0,
                cy=y + bh / 2.0,
                confidence=max(45.0, min(95.0, conf if conf > 0 else 60.0)),
            )
        )

    logger.info("OCR tag pass: %d D/W label(s) found", len(tags))
    return tags


def _detect_circle_tag_markers(image: np.ndarray) -> list[tuple[float, float, float]]:
    """
    Locate circled label markers (``(D1)`` / ``(W2)`` bubbles) via HoughCircles.

    Returns ``(cx, cy, radius)`` in canvas pixels.
    """
    gray = (
        image
        if image.ndim == 2
        else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    )
    blur = cv2.medianBlur(gray, 5)
    h, w = gray.shape[:2]
    min_r = max(6, int(min(w, h) * 0.008))
    max_r = max(min_r + 6, int(min(w, h) * 0.035))

    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=float(min_r * 3),
        param1=110,
        param2=32,
        minRadius=min_r,
        maxRadius=max_r,
    )
    if circles is None:
        return []

    found = [
        (float(c[0]), float(c[1]), float(c[2]))
        for c in np.round(circles[0]).astype(int)
    ]
    logger.info("Circle marker pass: %d bubble(s) found", len(found))
    return found


def _closest_wall(
    cx: float,
    cy: float,
    walls: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, float, tuple[float, float]]:
    """Nearest wall centreline to a point, with the projected foot point."""
    best: dict[str, Any] | None = None
    best_dist = float("inf")
    best_point = (cx, cy)

    for wall in walls:
        x1, y1 = float(wall["x1"]), float(wall["y1"])
        x2, y2 = float(wall["x2"]), float(wall["y2"])
        dx, dy = x2 - x1, y2 - y1
        denom = dx * dx + dy * dy
        if denom < 1e-6:
            continue
        t = max(0.0, min(1.0, ((cx - x1) * dx + (cy - y1) * dy) / denom))
        px, py = x1 + t * dx, y1 + t * dy
        dist = math.hypot(cx - px, cy - py)
        if dist < best_dist:
            best_dist = dist
            best = wall
            best_point = (px, py)

    return best, best_dist, best_point


def _perimeter_tol(bounds: dict[str, float]) -> float:
    span = min(bounds["max_x"] - bounds["min_x"], bounds["max_y"] - bounds["min_y"])
    return max(PERIMETER_WALL_TOL_PX, span * 0.06)


def _wall_is_perimeter(
    wall: dict[str, Any],
    bounds: dict[str, float],
    *,
    tol: float | None = None,
) -> bool:
    """True when a wall segment rides the house AABB envelope (exterior shell)."""
    edge_tol = tol if tol is not None else _perimeter_tol(bounds)
    x1, y1 = float(wall["x1"]), float(wall["y1"])
    x2, y2 = float(wall["x2"]), float(wall["y2"])
    horizontal = abs(x2 - x1) >= abs(y2 - y1)

    if horizontal:
        y = (y1 + y2) / 2.0
        on_north = abs(y - bounds["min_y"]) <= edge_tol
        on_south = abs(y - bounds["max_y"]) <= edge_tol
        return on_north or on_south

    x = (x1 + x2) / 2.0
    on_west = abs(x - bounds["min_x"]) <= edge_tol
    on_east = abs(x - bounds["max_x"]) <= edge_tol
    return on_west or on_east


def _detect_door_swing_arcs(image: np.ndarray) -> list[tuple[float, float, float]]:
    """
    Find quarter-circle door swing arcs drawn on CAD / scanned plans.

    Returns ``(centre_x, centre_y, radius)`` for each curved stroke whose arc
    length clearly exceeds its chord — the signature of a door swing symbol.
    """
    gray = (
        image
        if image.ndim == 2
        else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    )
    h, w = gray.shape[:2]
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 45, 140)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

    arcs: list[tuple[float, float, float]] = []
    max_dim = float(min(w, h))

    for cnt in contours:
        if len(cnt) < 14:
            continue
        arc_len = cv2.arcLength(cnt, False)
        if arc_len < 22.0:
            continue
        p0 = cnt[0][0]
        pn = cnt[-1][0]
        chord = float(np.hypot(float(p0[0] - pn[0]), float(p0[1] - pn[1])))
        if chord < 6.0 or arc_len / chord < SWING_ARC_MIN_CURVATURE:
            continue
        bx, by, bw, bh = cv2.boundingRect(cnt)
        if max(bw, bh) > max_dim * 0.18 or min(bw, bh) < 6:
            continue
        arcs.append((bx + bw / 2.0, by + bh / 2.0, max(bw, bh) / 2.0))

    logger.info("Door swing arc pass: %d arc(s) found", len(arcs))
    return arcs


def _near_swing_arc(
    cx: float,
    cy: float,
    arcs: list[tuple[float, float, float]],
    *,
    search_radius: float = SWING_ARC_SEARCH_RADIUS_PX,
) -> bool:
    for ax, ay, radius in arcs:
        if math.hypot(cx - ax, cy - ay) <= search_radius + radius:
            return True
    return False


def _opening_kind_from_context(
    cx: float,
    cy: float,
    walls: list[dict[str, Any]],
    bounds: dict[str, float] | None,
    swing_arcs: list[tuple[float, float, float]],
) -> str:
    """
    Classify an opening as ``door`` or ``window``.

    Interior partition walls and swing-arc symbols are always doors; perimeter
    shell walls are windows.
    """
    if _near_swing_arc(cx, cy, swing_arcs):
        return "door"

    wall, dist, _foot = _closest_wall(cx, cy, walls)
    if wall is not None and dist <= TAG_TO_WALL_SNAP_PX and bounds is not None:
        if _wall_is_perimeter(wall, bounds):
            return "window"
        return "door"

    # No reliable host wall — lean on swing arcs (handled above) and footprint.
    if bounds is not None:
        edge_tol = _perimeter_tol(bounds)
        on_shell = (
            abs(cx - bounds["min_x"]) <= edge_tol
            or abs(cx - bounds["max_x"]) <= edge_tol
            or abs(cy - bounds["min_y"]) <= edge_tol
            or abs(cy - bounds["max_y"]) <= edge_tol
        )
        return "window" if on_shell else "door"

    return "door"


def _opening_centre(opening: Detection) -> tuple[float, float]:
    return (
        opening.box.xmin + opening.box.width / 2.0,
        opening.box.ymin + opening.box.height / 2.0,
    )


def _is_door_detection(det: Detection) -> bool:
    label = det.label.lower()
    return det.id.startswith("D") or "door" in label


def _is_window_detection(det: Detection) -> bool:
    label = det.label.lower()
    return det.id.startswith("W") or "window" in label


def dedupe_openings_nms(
    openings: list[Detection],
    *,
    radius_px: float = OPENING_NMS_RADIUS_PX,
) -> list[Detection]:
    """
    Spatial NMS for door/window detections.

    YOLO and symbol fallback often fire multiple boxes on one doorway; keeping
    the highest-confidence centre within ``radius_px`` guarantees one mesh per
    opening in the 3D viewport.
    """
    if len(openings) < 2:
        return openings

    doors = [o for o in openings if _is_door_detection(o)]
    windows = [o for o in openings if _is_window_detection(o)]
    other = [
        o
        for o in openings
        if o not in doors and o not in windows
    ]

    def nms_cluster(items: list[Detection]) -> list[Detection]:
        ranked = sorted(items, key=lambda o: o.confidence, reverse=True)
        kept: list[Detection] = []
        for det in ranked:
            cx, cy = _opening_centre(det)
            if any(
                math.hypot(cx - _opening_centre(k)[0], cy - _opening_centre(k)[1])
                <= radius_px
                for k in kept
            ):
                continue
            kept.append(det)
        return kept

    deduped_doors = nms_cluster(doors)
    deduped_windows = nms_cluster(windows)

    deduped_doors.sort(key=_opening_centre)
    deduped_windows.sort(key=_opening_centre)

    renumbered: list[Detection] = []
    for idx, det in enumerate(deduped_doors, start=1):
        renumbered.append(
            Detection(
                id=f"D{idx}",
                label=f"Door D{idx}",
                confidence=det.confidence,
                box=det.box,
                source=det.source,
            )
        )
    for idx, det in enumerate(deduped_windows, start=1):
        renumbered.append(
            Detection(
                id=f"W{idx}",
                label=f"Window W{idx}",
                confidence=det.confidence,
                box=det.box,
                source=det.source,
            )
        )
    renumbered.extend(other)

    dropped = len(openings) - len(renumbered)
    if dropped:
        logger.info(
            "Opening NMS: %d -> %d (%d door(s), %d window(s), %d duplicate(s) removed)",
            len(openings),
            len(renumbered),
            len(deduped_doors),
            len(deduped_windows),
            dropped,
        )
    return renumbered


def reclassify_openings(
    openings: list[Detection],
    walls: list[dict[str, Any]],
    image: np.ndarray,
    bounds: dict[str, float] | None,
) -> list[Detection]:
    """
    Re-type YOLO / heuristic openings using wall context and swing arcs.

    CAD plans often label every opening as a window; this pass splits them into
    exterior windows and interior doors so counts match the real floor plan.
    """
    if not openings:
        return openings

    openings = dedupe_openings_nms(openings)
    bounds = bounds or house_bounds_from_walls(walls)
    swing_arcs = _detect_door_swing_arcs(image)

    typed: list[tuple[str, Detection, float, float]] = []
    for opening in openings:
        cx = opening.box.xmin + opening.box.width / 2.0
        cy = opening.box.ymin + opening.box.height / 2.0
        kind = _opening_kind_from_context(cx, cy, walls, bounds, swing_arcs)
        typed.append((kind, opening, cx, cy))

    typed.sort(key=lambda item: (item[3], item[2]))  # top-to-bottom, left-to-right

    doors = [item for item in typed if item[0] == "door"]
    windows = [item for item in typed if item[0] == "window"]

    renumbered: list[Detection] = []
    for idx, (_kind, opening, cx, cy) in enumerate(doors, start=1):
        wall, dist, foot = _closest_wall(cx, cy, walls)
        box = opening.box
        if wall is not None and dist <= TAG_TO_WALL_SNAP_PX:
            box = _opening_box_at(
                foot[0], foot[1], wall, DOOR_SYMBOL_SIZE_PX, CANVAS_SIZE
            )
        renumbered.append(
            Detection(
                id=f"D{idx}",
                label=f"Door D{idx}",
                confidence=opening.confidence,
                box=box,
                source=opening.source,
            )
        )

    for idx, (_kind, opening, cx, cy) in enumerate(windows, start=1):
        wall, dist, foot = _closest_wall(cx, cy, walls)
        box = opening.box
        if wall is not None and dist <= TAG_TO_WALL_SNAP_PX:
            box = _opening_box_at(
                foot[0], foot[1], wall, WINDOW_SYMBOL_SIZE_PX, CANVAS_SIZE
            )
        renumbered.append(
            Detection(
                id=f"W{idx}",
                label=f"Window W{idx}",
                confidence=opening.confidence,
                box=box,
                source=opening.source,
            )
        )

    logger.info(
        "Opening reclassification: %d door(s), %d window(s) (from %d raw)",
        len(doors),
        len(windows),
        len(openings),
    )
    return dedupe_openings_nms(renumbered)


def _opening_box_at(
    cx: float,
    cy: float,
    wall: dict[str, Any] | None,
    size: float,
    canvas: int,
) -> BoundingBox:
    """
    Build an opening box centred on the wall, elongated along the wall run.

    Keeping the long axis parallel to the wall lets the 3D viewport orient the
    window / door frame correctly and lets boolean subtraction cut a real gap.
    """
    half = size / 2.0
    thin = max(6.0, size * 0.28)

    horizontal = True
    if wall is not None:
        horizontal = abs(float(wall["x2"]) - float(wall["x1"])) >= abs(
            float(wall["y2"]) - float(wall["y1"])
        )

    if horizontal:
        box = BoundingBox(cx - half, cy - thin / 2.0, cx + half, cy + thin / 2.0)
    else:
        box = BoundingBox(cx - thin / 2.0, cy - half, cx + thin / 2.0, cy + half)
    return box.clip(canvas, canvas)


def _detect_perimeter_gaps(
    walls: list[dict[str, Any]],
    canvas: int = CANVAS_SIZE,
) -> list[OpeningTag]:
    """
    Classify physical breaks in the outer wall envelope as doors / windows.

    Used when neither YOLO nor tag OCR finds symbols: every real plan still has
    gaps where openings interrupt the perimeter run.
    """
    if not walls:
        return []

    xs = [float(w[k]) for w in walls for k in ("x1", "x2")]
    ys = [float(w[k]) for w in walls for k in ("y1", "y2")]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    tol = max(12.0, min(max_x - min_x, max_y - min_y) * 0.06)

    edges: list[tuple[str, float, float, float, bool]] = [
        ("north", min_y, min_x, max_x, True),
        ("south", max_y, min_x, max_x, True),
        ("west", min_x, min_y, max_y, False),
        ("east", max_x, min_y, max_y, False),
    ]

    tags: list[OpeningTag] = []
    for _name, fixed, a0, a1, horizontal in edges:
        spans: list[tuple[float, float]] = []
        for wall in walls:
            x1, y1 = float(wall["x1"]), float(wall["y1"])
            x2, y2 = float(wall["x2"]), float(wall["y2"])
            run_h = abs(x2 - x1) >= abs(y2 - y1)
            if run_h != horizontal:
                continue
            perp = (y1 + y2) / 2.0 if horizontal else (x1 + x2) / 2.0
            if abs(perp - fixed) > tol:
                continue
            lo, hi = sorted((x1, x2) if horizontal else (y1, y2))
            spans.append((lo, hi))

        if not spans:
            continue

        spans.sort()
        merged: list[list[float]] = []
        for lo, hi in spans:
            if merged and lo - merged[-1][1] <= 2.0:
                merged[-1][1] = max(merged[-1][1], hi)
            else:
                merged.append([lo, hi])

        for prev, nxt in zip(merged, merged[1:]):
            gap = nxt[0] - prev[1]
            if gap < GAP_MIN_PX or gap > GAP_MAX_PX:
                continue
            centre = (prev[1] + nxt[0]) / 2.0
            cx = centre if horizontal else fixed
            cy = fixed if horizontal else centre
            tags.append(
                OpeningTag(
                    kind="door" if gap <= GAP_DOOR_MAX_PX else "window",
                    index=0,
                    cx=float(np.clip(cx, 0, canvas)),
                    cy=float(np.clip(cy, 0, canvas)),
                    confidence=55.0,
                )
            )

    logger.info("Perimeter gap pass: %d opening(s) inferred", len(tags))
    return tags


def detect_opening_symbols(
    image: np.ndarray,
    walls: list[dict[str, Any]],
    canvas: int = CANVAS_SIZE,
) -> list[Detection]:
    """
    Hand-drawn door / window detector for plans where YOLOv8 finds nothing.

    Strategy (first productive source wins, then gaps top up the result):
    1. OCR ``D1``..``Dn`` / ``W1``..``Wn`` tags and snap each to its wall
    2. Circled label bubbles near a wall, typed by proximity to a wall break
    3. Physical gaps in the outer wall envelope
    """
    tags = _ocr_opening_tags(image)

    if not tags:
        gaps = _detect_perimeter_gaps(walls, canvas)
        # Circle bubbles refine gap typing: a bubble adjacent to a gap is a door
        for cx, cy, radius in _detect_circle_tag_markers(image):
            wall, dist, _ = _closest_wall(cx, cy, walls)
            if wall is None or dist > TAG_TO_WALL_SNAP_PX:
                continue
            tags.append(
                OpeningTag(
                    kind="door" if radius <= min(canvas, canvas) * 0.018 else "window",
                    index=0,
                    cx=cx,
                    cy=cy,
                    confidence=52.0,
                )
            )
        tags.extend(gaps)

    if not tags:
        return []

    doors: list[Detection] = []
    windows: list[Detection] = []

    for tag in tags:
        wall, dist, foot = _closest_wall(tag.cx, tag.cy, walls)
        # Snap the opening onto its wall so the 3D frame sits in the masonry
        if wall is not None and dist <= TAG_TO_WALL_SNAP_PX:
            cx, cy = foot
        else:
            wall, cx, cy = None, tag.cx, tag.cy

        size = DOOR_SYMBOL_SIZE_PX if tag.kind == "door" else WINDOW_SYMBOL_SIZE_PX
        box = _opening_box_at(cx, cy, wall, size, canvas)
        if box.area <= 0:
            continue

        if tag.kind == "door":
            idx = tag.index if tag.index > 0 else len(doors) + 1
            doors.append(
                Detection(
                    id=f"D{idx}",
                    label=f"Door D{idx}",
                    confidence=round(tag.confidence, 1),
                    box=box,
                    source="architectural",
                )
            )
        else:
            idx = tag.index if tag.index > 0 else len(windows) + 1
            windows.append(
                Detection(
                    id=f"W{idx}",
                    label=f"Window W{idx}",
                    confidence=round(tag.confidence, 1),
                    box=box,
                    source="architectural",
                )
            )

    def dedupe(items: list[Detection]) -> list[Detection]:
        kept: list[Detection] = []
        for det in items:
            cx = det.box.xmin + det.box.width / 2.0
            cy = det.box.ymin + det.box.height / 2.0
            if any(
                math.hypot(
                    cx - (k.box.xmin + k.box.width / 2.0),
                    cy - (k.box.ymin + k.box.height / 2.0),
                )
                < 40.0
                for k in kept
            ):
                continue
            kept.append(det)
        return kept

    doors = dedupe(doors)[:6]
    windows = dedupe(windows)[:8]

    # Renumber so labels read D1..Dn / W1..Wn in plan order
    ordered: list[Detection] = []
    for i, det in enumerate(doors, start=1):
        ordered.append(
            Detection(
                id=f"D{i}",
                label=f"Door D{i}",
                confidence=det.confidence,
                box=det.box,
                source="architectural",
            )
        )
    for i, det in enumerate(windows, start=1):
        ordered.append(
            Detection(
                id=f"W{i}",
                label=f"Window W{i}",
                confidence=det.confidence,
                box=det.box,
                source="architectural",
            )
        )

    logger.info(
        "Hand-drawn symbol detector: %d door(s), %d window(s)",
        len(doors),
        len(windows),
    )
    return ordered


# ---------------------------------------------------------------------------
# OpenCV — scanned blueprint wall extraction (adaptive + Hough + rooms)
# ---------------------------------------------------------------------------


def _segment_canonical_key(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    *,
    quantize: float = 3.0,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Direction-independent key so shared / near-duplicate edges merge once."""
    q = max(quantize, 0.5)

    def snap(v: float) -> float:
        return round(v / q) * q

    p1 = (snap(x1), snap(y1))
    p2 = (snap(x2), snap(y2))
    return (p1, p2) if p1 <= p2 else (p2, p1)


def _is_sheet_border_segment(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    img_w: int,
    img_h: int,
    *,
    margin_ratio: float = SHEET_MARGIN_RATIO,
) -> bool:
    """
    True when a segment lies wholly inside one of the sheet margin bands.

    Both endpoints must sit in the same band, so a real house wall that merely
    starts near the paper edge is kept while the printed frame is dropped.
    """
    left = margin_ratio * img_w
    right = (1.0 - margin_ratio) * img_w
    top = margin_ratio * img_h
    bottom = (1.0 - margin_ratio) * img_h

    if x1 < left and x2 < left:
        return True
    if x1 > right and x2 > right:
        return True
    if y1 < top and y2 < top:
        return True
    if y1 > bottom and y2 > bottom:
        return True
    return False


def _drop_sheet_border_segments(
    segments: list[dict[str, Any]],
    img_w: int,
    img_h: int,
) -> list[dict[str, Any]]:
    """Strip drawing-sheet frame lines from an extracted segment list."""
    kept = [
        seg
        for seg in segments
        if not _is_sheet_border_segment(
            float(seg["x1"]),
            float(seg["y1"]),
            float(seg["x2"]),
            float(seg["y2"]),
            img_w,
            img_h,
        )
    ]
    dropped = len(segments) - len(kept)
    if dropped:
        logger.info("Sheet-border filter: dropped %d frame segment(s)", dropped)
    return kept


def _is_sheet_border_contour(
    contour: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    perimeter_ratio: float = SHEET_BORDER_PERIMETER_RATIO,
) -> bool:
    """True when a contour traces the drawing-sheet frame rather than masonry."""
    image_perimeter = 2.0 * (img_w + img_h)
    if image_perimeter <= 0:
        return False
    if cv2.arcLength(contour, True) >= image_perimeter * perimeter_ratio:
        return True
    # A frame also fills nearly the whole canvas with its bounding rect
    x, y, bw, bh = cv2.boundingRect(contour)
    spans_canvas = (
        bw >= img_w * (1.0 - SHEET_MARGIN_RATIO * 2.0)
        and bh >= img_h * (1.0 - SHEET_MARGIN_RATIO * 2.0)
    )
    return spans_canvas


def _is_background_room_contour(
    contour: np.ndarray,
    img_w: int,
    img_h: int,
    img_area: float,
) -> bool:
    """Reject the outer paper margin / full-canvas white region."""
    area = float(cv2.contourArea(contour))
    if area >= img_area * 0.82:
        return True
    x, y, bw, bh = cv2.boundingRect(contour)
    margin = 8
    touches_border = (
        x <= margin
        or y <= margin
        or x + bw >= img_w - margin
        or y + bh >= img_h - margin
    )
    # Interior rooms never touch the canvas edge — the paper margin and the
    # open car porch both do. Rejecting every border-touching contour stops
    # the yard+porch region from being extruded as a rectangular outer wall.
    return touches_border


def _polygon_to_wall_segments(
    polygon: np.ndarray,
    *,
    thickness: int,
    min_edge_length: float = 8.0,
) -> list[dict[str, int]]:
    """Convert a closed room polygon into connected boundary wall segments."""
    pts = polygon.reshape(-1, 2)
    if len(pts) < 3:
        return []

    segments: list[dict[str, int]] = []
    n = len(pts)
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        x1, y1 = int(p1[0]), int(p1[1])
        x2, y2 = int(p2[0]), int(p2[1])
        if math.hypot(x2 - x1, y2 - y1) < min_edge_length:
            continue
        segments.append(
            {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "thickness": thickness,
            }
        )
    return segments


def _build_scanned_ink_mask(gray: np.ndarray) -> np.ndarray:
    """
    Isolate thick black wall ink on uneven scanned paper.

    Adaptive Gaussian threshold handles gray backgrounds / lighting gradients
    that defeat a fixed global threshold.
    """
    # Mild blur reduces paper grain without erasing wall strokes
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    block = ADAPTIVE_BLOCK_SIZE if ADAPTIVE_BLOCK_SIZE % 2 == 1 else ADAPTIVE_BLOCK_SIZE + 1
    thresh = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block,
        ADAPTIVE_C,
    )
    # Open removes speck / text dots; close reseals dashed wall strokes
    kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open, iterations=1)
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    sealed = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel_close, iterations=1)
    return sealed


def _thick_wall_mask(ink: np.ndarray) -> np.ndarray:
    """Keep elongated masonry runs (H/V/diagonal); drop furniture blobs."""
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 3))
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 21))
    kernel_d1 = np.eye(15, dtype=np.uint8)
    kernel_d2 = np.fliplr(kernel_d1).copy()
    walls_h = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel_h)
    walls_v = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel_v)
    walls_d1 = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel_d1)
    walls_d2 = cv2.morphologyEx(ink, cv2.MORPH_OPEN, kernel_d2)
    return cv2.bitwise_or(
        cv2.bitwise_or(walls_h, walls_v),
        cv2.bitwise_or(walls_d1, walls_d2),
    )


def _append_unique_segment(
    walls: list[dict[str, int]],
    seen: set[tuple[tuple[float, float], tuple[float, float]]],
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    thickness: int,
    *,
    min_length: float = MIN_WALL_SEGMENT_LENGTH_PX,
) -> bool:
    length = math.hypot(x2 - x1, y2 - y1)
    if length < min_length:
        return False
    key = _segment_canonical_key(x1, y1, x2, y2)
    if key in seen:
        return False
    seen.add(key)
    walls.append(
        {
            "x1": int(round(x1)),
            "y1": int(round(y1)),
            "x2": int(round(x2)),
            "y2": int(round(y2)),
            "thickness": thickness,
        }
    )
    return True


def _segments_from_wall_contours(
    wall_mask: np.ndarray,
    *,
    thickness: int,
    img_area: float,
) -> list[dict[str, int]]:
    """Oriented centreline of each elongated wall-ink contour (interior + exterior)."""
    contours, _ = cv2.findContours(
        wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    img_h, img_w = wall_mask.shape[:2]
    walls: list[dict[str, int]] = []
    seen: set[tuple[tuple[float, float], tuple[float, float]]] = set()

    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < img_area * 0.00025 or area > img_area * 0.35:
            continue
        # Reject the printed drawing-sheet frame before it becomes a giant wall
        if _is_sheet_border_contour(contour, img_w, img_h):
            continue
        (_, _), (rw, rh), angle_deg = cv2.minAreaRect(contour)
        long_side = max(rw, rh)
        short_side = max(min(rw, rh), 1.0)
        if long_side < MIN_WALL_SEGMENT_LENGTH_PX:
            continue
        if long_side / short_side < 1.4:
            continue

        # Long-axis endpoints from minAreaRect
        theta = math.radians(angle_deg if rw >= rh else angle_deg + 90.0)
        cx = float(cv2.moments(contour)["m10"] / max(cv2.moments(contour)["m00"], 1e-6))
        cy = float(cv2.moments(contour)["m01"] / max(cv2.moments(contour)["m00"], 1e-6))
        # Prefer rect centre when moments fail on thin strokes
        (rcx, rcy), _, _ = cv2.minAreaRect(contour)
        if not math.isfinite(cx) or not math.isfinite(cy):
            cx, cy = float(rcx), float(rcy)
        hx = math.cos(theta) * long_side / 2.0
        hy = math.sin(theta) * long_side / 2.0
        # Store the measured ink width so dimension lines stay distinguishable
        # from masonry. Forcing every stroke to WALL_SEGMENT_THICKNESS_PX made
        # a 2 px dimension line look like a wall and let it swallow the house.
        stroke = int(round(max(2.0, min(short_side, 18.0))))
        if _is_sheet_border_segment(
            cx - hx, cy - hy, cx + hx, cy + hy, img_w, img_h
        ):
            continue
        _append_unique_segment(
            walls,
            seen,
            cx - hx,
            cy - hy,
            cx + hx,
            cy + hy,
            stroke,
        )

    return walls


def _segments_from_hough(
    edge_or_mask: np.ndarray,
    *,
    thickness: int,
) -> list[dict[str, int]]:
    """Hough line segments on wall ink / edges for partition recovery."""
    lines = cv2.HoughLinesP(
        edge_or_mask,
        rho=1,
        theta=np.pi / 180,
        threshold=HOUGH_THRESHOLD,
        minLineLength=HOUGH_MIN_LINE_LENGTH,
        maxLineGap=HOUGH_MAX_LINE_GAP,
    )
    walls: list[dict[str, int]] = []
    seen: set[tuple[tuple[float, float], tuple[float, float]]] = set()
    if lines is None:
        return walls
    img_h, img_w = edge_or_mask.shape[:2]
    for line in lines:
        x1, y1, x2, y2 = (float(v) for v in line[0])
        if _is_sheet_border_segment(x1, y1, x2, y2, img_w, img_h):
            continue
        _append_unique_segment(walls, seen, x1, y1, x2, y2, thickness)
    return walls


def _segments_from_room_polygons(
    ink_mask: np.ndarray,
    *,
    thickness: int,
    min_room_area: int,
) -> list[dict[str, int]]:
    """
    Room-space contours (white interiors) → watertight boundary edges.

    Inverts the ink mask so enclosed bedrooms / pantry / toilet / sitting
    become separate polygons whose edges are shared walls.
    """
    h, w = ink_mask.shape[:2]
    img_area = float(h * w)
    # Dilate ink slightly so tiny door gaps don't merge adjacent rooms
    seal = cv2.dilate(
        ink_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1
    )
    rooms = cv2.bitwise_not(seal)

    # Clear a thin border so the outer paper margin isn't one giant "room"
    border = 4
    rooms[:border, :] = 0
    rooms[-border:, :] = 0
    rooms[:, :border] = 0
    rooms[:, -border:] = 0

    contours, _ = cv2.findContours(
        rooms, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )
    walls: list[dict[str, int]] = []
    seen: set[tuple[tuple[float, float], tuple[float, float]]] = set()
    rooms_kept = 0

    for cnt in contours:
        area = float(cv2.contourArea(cnt))
        if area < float(min_room_area):
            continue
        if _is_background_room_contour(cnt, w, h, img_area):
            continue
        # The paper margin ring also reads as a "room" — reject it
        if _is_sheet_border_contour(cnt, w, h):
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(
            cnt, ROOM_POLYGON_EPSILON_RATIO * peri, True
        )
        if len(approx) < 3:
            continue
        rooms_kept += 1
        for seg in _polygon_to_wall_segments(
            approx, thickness=thickness, min_edge_length=MIN_WALL_SEGMENT_LENGTH_PX * 0.6
        ):
            if _is_sheet_border_segment(
                seg["x1"], seg["y1"], seg["x2"], seg["y2"], w, h
            ):
                continue
            _append_unique_segment(
                walls,
                seen,
                seg["x1"],
                seg["y1"],
                seg["x2"],
                seg["y2"],
                thickness,
                min_length=MIN_WALL_SEGMENT_LENGTH_PX * 0.6,
            )

    logger.info("Room-polygon pass: %d interior room(s)", rooms_kept)
    return walls


def _merge_near_duplicate_walls(
    walls: list[dict[str, int]],
    *,
    dist_tol: float = 12.0,
    angle_tol_deg: float = 5.0,
) -> list[dict[str, int]]:
    """
    Collapse near-collinear overlapping segments from multi-pass extraction.

    Keeps the longer centreline when two walls share the same corridor.
    """
    if len(walls) <= 1:
        return walls

    def angle(s: dict[str, int]) -> float:
        return math.atan2(s["y2"] - s["y1"], s["x2"] - s["x1"])

    def length(s: dict[str, int]) -> float:
        return math.hypot(s["x2"] - s["x1"], s["y2"] - s["y1"])

    def midpoint(s: dict[str, int]) -> tuple[float, float]:
        return ((s["x1"] + s["x2"]) / 2.0, (s["y1"] + s["y2"]) / 2.0)

    def dist_point_to_segment(
        px: float, py: float, s: dict[str, int]
    ) -> float:
        x1, y1, x2, y2 = s["x1"], s["y1"], s["x2"], s["y2"]
        dx, dy = x2 - x1, y2 - y1
        denom = dx * dx + dy * dy
        if denom < 1e-6:
            return math.hypot(px - x1, py - y1)
        t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / denom))
        return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

    def thickness(s: dict[str, int]) -> float:
        return float(s.get("thickness") or 0)

    # Prefer masonry over a longer-but-thinner dimension line that shares
    # its corridor — otherwise the dimension line is kept and the real wall
    # is discarded as a "duplicate".
    ordered = sorted(walls, key=lambda s: (thickness(s), length(s)), reverse=True)
    kept: list[dict[str, int]] = []
    for cand in ordered:
        mx, my = midpoint(cand)
        ang = angle(cand)
        duplicate = False
        for existing in kept:
            dang = abs(ang - angle(existing))
            dang = min(dang, abs(dang - math.pi), abs(dang + math.pi))
            if dang > math.radians(angle_tol_deg) and dang < math.pi - math.radians(
                angle_tol_deg
            ):
                continue
            if dist_point_to_segment(mx, my, existing) <= dist_tol:
                duplicate = True
                break
        if not duplicate:
            kept.append(cand)
    return kept


def _segment_length(seg: dict[str, Any]) -> float:
    return math.hypot(
        float(seg["x2"]) - float(seg["x1"]), float(seg["y2"]) - float(seg["y1"])
    )


def _normalized_direction(seg: dict[str, Any]) -> tuple[float, float]:
    dx = float(seg["x2"]) - float(seg["x1"])
    dy = float(seg["y2"]) - float(seg["y1"])
    length = math.hypot(dx, dy) or 1.0
    dx, dy = dx / length, dy / length
    # Canonical orientation (angle in [0, pi)) so opposite directions cluster.
    if dy < 0 or (abs(dy) < 1e-9 and dx < 0):
        dx, dy = -dx, -dy
    return dx, dy


def _segment_is_horizontal(seg: dict[str, Any]) -> bool:
    return abs(float(seg["x2"]) - float(seg["x1"])) >= abs(
        float(seg["y2"]) - float(seg["y1"])
    )


def _segment_run_span(
    seg: dict[str, Any], horizontal: bool
) -> tuple[float, float, float]:
    """Return ``(along_lo, along_hi, perpendicular_coord)`` for a segment."""
    x1, y1 = float(seg["x1"]), float(seg["y1"])
    x2, y2 = float(seg["x2"]), float(seg["y2"])
    if horizontal:
        return (min(x1, x2), max(x1, x2), (y1 + y2) / 2.0)
    return (min(y1, y2), max(y1, y2), (x1 + x2) / 2.0)


def _centreline_from_cluster(
    cluster: list[dict[str, Any]], horizontal: bool
) -> dict[str, Any]:
    """Fuse parallel double-wall strokes into one centreline."""
    if len(cluster) == 1:
        return cluster[0]

    spans = [_segment_run_span(seg, horizontal) for seg in cluster]
    lo = min(s[0] for s in spans)
    hi = max(s[1] for s in spans)
    perp = sum(s[2] for s in spans) / len(spans)
    thickness = max(
        float(seg.get("thickness") or WALL_SEGMENT_THICKNESS_PX) for seg in cluster
    )
    template = cluster[0]
    if horizontal:
        merged = {
            **template,
            "x1": int(round(lo)),
            "y1": int(round(perp)),
            "x2": int(round(hi)),
            "y2": int(round(perp)),
        }
    else:
        merged = {
            **template,
            "x1": int(round(perp)),
            "y1": int(round(lo)),
            "x2": int(round(perp)),
            "y2": int(round(hi)),
        }
    merged["thickness"] = int(round(thickness))
    return merged


def _merge_double_wall_centrelines(
    segments: list[dict[str, Any]],
    *,
    min_gap_px: float = DOUBLE_WALL_MIN_GAP_PX,
    max_gap_px: float = DOUBLE_WALL_MAX_GAP_PX,
    min_overlap_px: float = DOUBLE_WALL_MIN_OVERLAP_PX,
) -> list[dict[str, Any]]:
    """
    Merge parallel inner/outer face lines into a single wall centreline.

    CAD plans draw each wall as two parallel strokes. When a pair (or cluster)
    is separated by ``min_gap_px``–``max_gap_px`` and overlaps along the run,
    they become one segment at the midpoint — never two 3D slabs.
    """
    if len(segments) < 2:
        return segments

    buckets: dict[str, list[tuple[int, dict[str, Any]]]] = {"h": [], "v": []}
    for idx, seg in enumerate(segments):
        key = "h" if _segment_is_horizontal(seg) else "v"
        buckets[key].append((idx, seg))

    used: set[int] = set()
    merged: list[dict[str, Any]] = []

    for horizontal in (True, False):
        key = "h" if horizontal else "v"
        for idx, seed in buckets[key]:
            if idx in used:
                continue
            cluster = [seed]
            used.add(idx)
            lo, hi, _ = _segment_run_span(seed, horizontal)
            perps = [_segment_run_span(seed, horizontal)[2]]

            expanded = True
            while expanded:
                expanded = False
                for jdx, other in buckets[key]:
                    if jdx in used:
                        continue
                    olo, ohi, operp = _segment_run_span(other, horizontal)
                    overlap = min(hi, ohi) - max(lo, olo)
                    if overlap < min_overlap_px:
                        continue
                    min_perp_gap = min(abs(operp - p) for p in perps)
                    if min_gap_px <= min_perp_gap <= max_gap_px:
                        cluster.append(other)
                        used.add(jdx)
                        perps.append(operp)
                        lo, hi = min(lo, olo), max(hi, ohi)
                        expanded = True

            merged.append(_centreline_from_cluster(cluster, horizontal))

    if len(merged) < len(segments):
        logger.info(
            "Double-wall merge: %d parallel stroke(s) -> %d centreline(s)",
            len(segments),
            len(merged),
        )
    return merged


def _orthogonalize_segments(
    segments: list[dict[str, Any]],
    *,
    tol_deg: float = ORTHO_SNAP_TOL_DEG,
) -> list[dict[str, Any]]:
    """
    Snap near-axis walls to exactly 0°/90° and drop oblique artifacts.

    ``minAreaRect`` reports an arbitrary long axis for stubby or L-shaped ink
    blobs, and the diagonal structuring elements keep hatching and leader lines
    alive. Both surface as long slanted slabs in the 3D scene, so anything that
    isn't within tolerance of an axis is removed instead of snapped.
    """
    kept: list[dict[str, Any]] = []
    dropped = 0

    for seg in segments:
        x1, y1 = float(seg["x1"]), float(seg["y1"])
        x2, y2 = float(seg["x2"]), float(seg["y2"])
        dx, dy = x2 - x1, y2 - y1
        if math.hypot(dx, dy) < MIN_WALL_LENGTH_PX:
            dropped += 1
            continue

        angle = math.degrees(math.atan2(abs(dy), abs(dx)))
        if angle <= tol_deg:
            y = (y1 + y2) / 2.0
            x1, x2 = min(x1, x2), max(x1, x2)
            y1 = y2 = y
        elif angle >= 90.0 - tol_deg:
            x = (x1 + x2) / 2.0
            y1, y2 = min(y1, y2), max(y1, y2)
            x1 = x2 = x
        else:
            dropped += 1
            continue

        kept.append({**seg, "x1": x1, "y1": y1, "x2": x2, "y2": y2})

    if dropped:
        logger.info(
            "Orthogonal filter: dropped %d oblique/short segment(s), kept %d",
            dropped,
            len(kept),
        )
    return kept


def _snap_segments_to_grid(
    segments: list[dict[str, Any]],
    *,
    tol_px: float = GRID_SNAP_TOL_PX,
) -> list[dict[str, Any]]:
    """
    Pull parallel walls onto shared grid lines.

    Separate extraction passes measure the same wall a few pixels apart. Without
    this, "collinear" walls are slightly offset and their corners never meet.
    """

    def build_lines(values: list[float]) -> list[float]:
        groups: list[list[float]] = []
        for v in sorted(values):
            if groups and v - groups[-1][0] <= tol_px:
                groups[-1].append(v)
            else:
                groups.append([v])
        return [sum(group) / len(group) for group in groups]

    horizontals = [s for s in segments if abs(float(s["y2"]) - float(s["y1"])) < 1e-6]
    verticals = [s for s in segments if abs(float(s["x2"]) - float(s["x1"])) < 1e-6]

    z_lines = build_lines([float(s["y1"]) for s in horizontals])
    x_lines = build_lines([float(s["x1"]) for s in verticals])

    def nearest(value: float, lines: list[float]) -> float:
        if not lines:
            return value
        best = min(lines, key=lambda line: abs(line - value))
        return best if abs(best - value) <= tol_px else value

    snapped: list[dict[str, Any]] = []
    for seg in segments:
        out = dict(seg)
        if abs(float(seg["y2"]) - float(seg["y1"])) < 1e-6:
            y = nearest(float(seg["y1"]), z_lines)
            out["y1"] = out["y2"] = y
            out["x1"] = nearest(float(seg["x1"]), x_lines)
            out["x2"] = nearest(float(seg["x2"]), x_lines)
        else:
            x = nearest(float(seg["x1"]), x_lines)
            out["x1"] = out["x2"] = x
            out["y1"] = nearest(float(seg["y1"]), z_lines)
            out["y2"] = nearest(float(seg["y2"]), z_lines)
        if _segment_length(out) >= MIN_WALL_LENGTH_PX:
            snapped.append(out)

    return snapped


def _bridge_collinear_gaps(
    segments: list[dict[str, Any]],
    *,
    tol_px: float = BRIDGE_GAP_TOL_PX,
) -> list[dict[str, Any]]:
    """
    Join collinear walls separated by a short hole.

    This is the only masonry the pipeline invents, and it only ever appears in
    line with walls that were actually detected — never along the bounding box.
    Filling the bounding box instead would close a car porch cutout and turn an
    L-shaped plan into a rectangle.
    """
    groups: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for seg in segments:
        horizontal = abs(float(seg["y2"]) - float(seg["y1"])) < 1e-6
        axis = "h" if horizontal else "v"
        line = float(seg["y1"]) if horizontal else float(seg["x1"])
        groups.setdefault((axis, int(round(line / 2.0))), []).append(seg)

    bridged: list[dict[str, Any]] = []
    for (axis, _), group in groups.items():
        horizontal = axis == "h"
        line = sum(
            float(s["y1"]) if horizontal else float(s["x1"]) for s in group
        ) / len(group)

        spans: list[tuple[float, float, float]] = []
        for seg in group:
            lo, hi = sorted(
                (float(seg["x1"]), float(seg["x2"]))
                if horizontal
                else (float(seg["y1"]), float(seg["y2"]))
            )
            spans.append((lo, hi, float(seg.get("thickness") or WALL_SEGMENT_THICKNESS_PX)))
        spans.sort()

        cur_lo, cur_hi, cur_th = spans[0]
        for lo, hi, th in spans[1:]:
            if lo - cur_hi <= tol_px:
                cur_hi = max(cur_hi, hi)
                cur_th = max(cur_th, th)
            else:
                bridged.append(_span_to_segment(horizontal, line, cur_lo, cur_hi, cur_th))
                cur_lo, cur_hi, cur_th = lo, hi, th
        bridged.append(_span_to_segment(horizontal, line, cur_lo, cur_hi, cur_th))

    return bridged


def _span_to_segment(
    horizontal: bool,
    line: float,
    lo: float,
    hi: float,
    thickness: float,
) -> dict[str, Any]:
    if horizontal:
        return {"x1": lo, "y1": line, "x2": hi, "y2": line, "thickness": int(round(thickness))}
    return {"x1": line, "y1": lo, "x2": line, "y2": hi, "thickness": int(round(thickness))}


def _weld_segment_corners(
    segments: list[dict[str, Any]],
    *,
    tol_px: float = CORNER_WELD_TOL_PX,
) -> list[dict[str, Any]]:
    """
    Extend wall ends onto nearby perpendicular walls so corners close.

    Extraction stops a wall short wherever ink thins out, which reads as an open
    gap in the exterior boundary. Each free end is pulled to the crossing wall's
    line when one sits within tolerance and actually spans that end.
    """
    horizontals = [s for s in segments if abs(float(s["y2"]) - float(s["y1"])) < 1e-6]
    verticals = [s for s in segments if abs(float(s["x2"]) - float(s["x1"])) < 1e-6]

    def weld(value: float, along: float, others: list[dict[str, Any]], axis: str) -> float:
        """Snap ``value`` to the closest crossing wall that covers ``along``."""
        best = value
        best_gap = tol_px
        for other in others:
            if axis == "x":
                line = float(other["x1"])
                lo, hi = sorted((float(other["y1"]), float(other["y2"])))
            else:
                line = float(other["y1"])
                lo, hi = sorted((float(other["x1"]), float(other["x2"])))
            if not (lo - tol_px <= along <= hi + tol_px):
                continue
            gap = abs(line - value)
            if gap < best_gap:
                best_gap = gap
                best = line
        return best

    welded: list[dict[str, Any]] = []
    for seg in segments:
        out = dict(seg)
        if abs(float(seg["y2"]) - float(seg["y1"])) < 1e-6:
            y = float(seg["y1"])
            out["x1"] = weld(float(seg["x1"]), y, verticals, "x")
            out["x2"] = weld(float(seg["x2"]), y, verticals, "x")
        else:
            x = float(seg["x1"])
            out["y1"] = weld(float(seg["y1"]), x, horizontals, "y")
            out["y2"] = weld(float(seg["y2"]), x, horizontals, "y")
        if _segment_length(out) >= MIN_WALL_LENGTH_PX:
            welded.append(out)

    return welded


def _collapse_coplanar_segments(
    segments: list[dict[str, Any]],
    *,
    tol_px: float = GRID_SNAP_TOL_PX,
) -> list[dict[str, Any]]:
    """
    Merge parallel segments on the same wall line into one centreline.

    Residual double strokes on an elevation (e.g. the bottom front wall) become
    a single crisp segment instead of two overlapping extrusions.
    """
    if len(segments) < 2:
        return segments

    buckets: dict[str, list[dict[str, Any]]] = {"h": [], "v": []}
    for seg in segments:
        key = "h" if _segment_is_horizontal(seg) else "v"
        buckets[key].append(seg)

    used: set[int] = set()
    merged: list[dict[str, Any]] = []

    for horizontal in (True, False):
        key = "h" if horizontal else "v"
        for seed in buckets[key]:
            sid = id(seed)
            if sid in used:
                continue
            cluster = [seed]
            used.add(sid)
            lo, hi, _ = _segment_run_span(seed, horizontal)
            perps = [_segment_run_span(seed, horizontal)[2]]

            expanded = True
            while expanded:
                expanded = False
                mean_perp = sum(perps) / len(perps)
                for other in buckets[key]:
                    oid = id(other)
                    if oid in used:
                        continue
                    olo, ohi, operp = _segment_run_span(other, horizontal)
                    if abs(operp - mean_perp) > tol_px:
                        continue
                    overlap = min(hi, ohi) - max(lo, olo)
                    union = max(hi, ohi) - min(lo, olo)
                    if overlap < 8.0 and union > overlap + 12.0:
                        continue
                    cluster.append(other)
                    used.add(oid)
                    perps.append(operp)
                    lo, hi = min(lo, olo), max(hi, ohi)
                    expanded = True

            merged.append(_centreline_from_cluster(cluster, horizontal))

    if len(merged) < len(segments):
        logger.info(
            "Coplanar wall merge: %d segment(s) -> %d centreline(s)",
            len(segments),
            len(merged),
        )
    return merged


def consolidate_wall_segments(
    segments: list[dict[str, Any]],
    *,
    min_length: float = MIN_WALL_LENGTH_PX,
    angle_tol_deg: float = COLLINEAR_ANGLE_TOL_DEG,
    offset_tol_px: float = COLLINEAR_OFFSET_TOL_PX,
    merge_gap_px: float = SPAN_MERGE_GAP_PX,
    max_walls: int = MAX_CONSOLIDATED_WALLS,
) -> list[dict[str, int]]:
    """
    Collapse fragmented strokes into clean, solid wall centrelines.

    Hand-drawn / scanned plans produce many duplicate parallel strokes (hatching,
    dimension lines, double-line wall conventions). This groups segments that
    share an orientation and a perpendicular offset, then unions their spans
    along the shared axis so each real wall becomes one centreline.
    """
    # 1) Drop tiny stroke noise from text / hatching
    usable = [s for s in segments if _segment_length(s) >= min_length]
    if not usable:
        return []

    angle_tol = math.radians(angle_tol_deg)

    @dataclass
    class Cluster:
        dx: float
        dy: float
        offset: float
        thickness: float
        spans: list[tuple[float, float]]
        origin: tuple[float, float]

    clusters: list[Cluster] = []

    def _is_masonry(th: float) -> bool:
        return th > DIMENSION_MAX_THICKNESS_PX

    for seg in sorted(
        usable,
        key=lambda s: (
            float(s.get("thickness") or 0),
            _segment_length(s),
        ),
        reverse=True,
    ):
        dx, dy = _normalized_direction(seg)
        x1, y1 = float(seg["x1"]), float(seg["y1"])
        x2, y2 = float(seg["x2"]), float(seg["y2"])
        thickness = float(seg.get("thickness") or WALL_SEGMENT_THICKNESS_PX)
        # Signed perpendicular distance from the image origin to the line
        offset = -dy * x1 + dx * y1
        t_lo, t_hi = 0.0, dx * (x2 - x1) + dy * (y2 - y1)
        if t_hi < t_lo:
            t_lo, t_hi = t_hi, t_lo

        target: Cluster | None = None
        for cluster in clusters:
            dot = abs(cluster.dx * dx + cluster.dy * dy)
            dot = min(1.0, dot)
            if math.acos(dot) > angle_tol:
                continue
            # Compare offsets in the cluster's own frame
            cluster_offset = -cluster.dy * x1 + cluster.dx * y1
            if abs(cluster_offset - cluster.offset) > offset_tol_px:
                continue
            target = cluster
            break

        if target is None:
            # A lone dimension line is not a wall — don't start a cluster
            if not _is_masonry(thickness):
                continue
            clusters.append(
                Cluster(
                    dx=dx,
                    dy=dy,
                    offset=offset,
                    thickness=thickness,
                    spans=[(t_lo, t_hi)],
                    origin=(x1, y1),
                )
            )
            continue

        ox, oy = target.origin
        t1 = target.dx * (x1 - ox) + target.dy * (y1 - oy)
        t2 = target.dx * (x2 - ox) + target.dy * (y2 - oy)
        lo, hi = (min(t1, t2), max(t1, t2))
        # Thin strokes may reinforce an existing masonry span, never extend it
        # past the house and across a car porch / veranda mouth.
        if not _is_masonry(thickness):
            if any(lo <= e and hi >= s for s, e in target.spans):
                target.thickness = max(target.thickness, thickness)
            continue
        target.spans.append((lo, hi))
        target.thickness = max(target.thickness, thickness)

    # 2) Union overlapping / near-touching spans within each cluster
    consolidated: list[dict[str, int]] = []
    for cluster in clusters:
        cluster.spans.sort(key=lambda s: s[0])
        merged: list[list[float]] = []
        for start, end in cluster.spans:
            if merged and start - merged[-1][1] <= merge_gap_px:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])

        ox, oy = cluster.origin
        for start, end in merged:
            if end - start < min_length:
                continue
            consolidated.append(
                {
                    "x1": int(round(ox + cluster.dx * start)),
                    "y1": int(round(oy + cluster.dy * start)),
                    "x2": int(round(ox + cluster.dx * end)),
                    "y2": int(round(oy + cluster.dy * end)),
                    "thickness": int(round(cluster.thickness)),
                }
            )

    # 3) Longest walls first, then cap so the 3D scene stays legible
    consolidated.sort(key=_segment_length, reverse=True)
    if max_walls > 0:
        consolidated = consolidated[:max_walls]

    logger.info(
        "Wall consolidation: %d raw → %d usable → %d solid walls",
        len(segments),
        len(usable),
        len(consolidated),
    )
    return consolidated


def house_bounds_from_walls(
    walls: list[dict[str, Any]],
) -> dict[str, float] | None:
    """
    True pixel bounding box of the house, excluding the drawing-sheet frame.

    Callers use the centre of this box (not the image centre) as the origin so
    walls, doors and windows all share one aligned coordinate frame.
    """
    if not walls:
        return None

    xs = [float(w[k]) for w in walls for k in ("x1", "x2")]
    ys = [float(w[k]) for w in walls for k in ("y1", "y2")]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    return {
        "min_x": round(min_x, 2),
        "min_y": round(min_y, 2),
        "max_x": round(max_x, 2),
        "max_y": round(max_y, 2),
        "center_x": round((min_x + max_x) / 2.0, 2),
        "center_y": round((min_y + max_y) / 2.0, 2),
        "width": round(max_x - min_x, 2),
        "height": round(max_y - min_y, 2),
    }


def _mark_outside_pixels(ink: np.ndarray) -> np.ndarray:
    """
    Flood-fill the paper from the image border, after sealing doorway-sized
    gaps so rooms stay enclosed.

    The car porch is open on two sides with a mouth much wider than a door, so
    it stays connected to the margin and is marked outside. Bedrooms are not.
    """
    h, w = ink.shape[:2]
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    sealed = cv2.dilate(ink, kernel, iterations=2)
    open_space = np.where(sealed > 0, 0, 255).astype(np.uint8)
    flood = open_space.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    if flood[0, 0] == 0:
        # Seed on the first white border pixel so we don't flood a wall
        ys, xs = np.where(flood > 0)
        if len(xs) == 0:
            return np.zeros_like(ink)
        cv2.floodFill(flood, mask, (int(xs[0]), int(ys[0])), 128)
    else:
        cv2.floodFill(flood, mask, (0, 0), 128)
    return np.where(flood == 128, 255, 0).astype(np.uint8)


def _cutout_from_outside(
    outside: np.ndarray,
    bounds: dict[str, float],
) -> dict[str, float] | None:
    """
    Largest empty corner of the house AABB that is open to the paper margin.

    That region is the car porch (or any similar inset). Rooms are enclosed by
    ink, so the border flood never reaches them.
    """
    h, w = outside.shape[:2]
    x0 = int(max(0, math.floor(bounds["min_x"])))
    y0 = int(max(0, math.floor(bounds["min_y"])))
    x1 = int(min(w, math.ceil(bounds["max_x"])))
    y1 = int(min(h, math.ceil(bounds["max_y"])))
    if x1 - x0 < 20 or y1 - y0 < 20:
        return None

    roi = outside[y0:y1, x0:x1]
    if int(cv2.countNonZero(roi)) < 80:
        return None

    bw = x1 - x0
    bh = y1 - y0
    min_w = max(40, int(bw * 0.10))
    min_h = max(40, int(bh * 0.10))

    corners = (
        ("nw", 0, 0),
        ("ne", bw - 1, 0),
        ("sw", 0, bh - 1),
        ("se", bw - 1, bh - 1),
    )
    best: dict[str, float] | None = None
    best_area = 0

    for name, cx, cy in corners:
        if roi[cy, cx] == 0:
            # Walk inward a few pixels — the exact AABB corner may sit on ink
            found = False
            step_x = 1 if cx == 0 else -1
            step_y = 1 if cy == 0 else -1
            for d in range(1, 12):
                px = int(np.clip(cx + step_x * d, 0, bw - 1))
                py = int(np.clip(cy + step_y * d, 0, bh - 1))
                if roi[py, px] > 0:
                    cx, cy = px, py
                    found = True
                    break
            if not found:
                continue

        mask = np.zeros((bh + 2, bw + 2), np.uint8)
        flood = roi.copy()
        cv2.floodFill(flood, mask, (int(cx), int(cy)), 64)
        blob = np.where(flood == 64, 255, 0).astype(np.uint8)
        x, y, rw, rh = cv2.boundingRect(blob)
        if rw < min_w or rh < min_h:
            continue
        area = rw * rh
        if area > best_area:
            best_area = area
            best = {
                "min_x": float(x0 + x),
                "min_y": float(y0 + y),
                "max_x": float(x0 + x + rw),
                "max_y": float(y0 + y + rh),
                "corner": name,
            }
    return best


def _trim_walls_to_cutout(
    walls: list[dict[str, Any]],
    bounds: dict[str, float],
    cutout: dict[str, float],
    *,
    edge_tol: float = 16.0,
) -> list[dict[str, Any]]:
    """
    Remove masonry that closes the car porch mouth.

    A dimension line or a yard-contour edge often rides the house AABB and
    walls the porch shut. Anything sitting on that AABB and overlapping the
    cutout is split so only the real house wall remains.
    """
    cmin_x, cmax_x = cutout["min_x"], cutout["max_x"]
    cmin_y, cmax_y = cutout["min_y"], cutout["max_y"]
    min_x, max_x = bounds["min_x"], bounds["max_x"]
    min_y, max_y = bounds["min_y"], bounds["max_y"]

    def split_horizontal(seg: dict[str, Any], y: float) -> list[dict[str, Any]]:
        lo, hi = sorted((float(seg["x1"]), float(seg["x2"])))
        pieces: list[tuple[float, float]] = []
        # Keep parts that do not overlap the cutout in x
        if lo < cmin_x - 1:
            pieces.append((lo, min(hi, cmin_x)))
        if hi > cmax_x + 1:
            pieces.append((max(lo, cmax_x), hi))
        out: list[dict[str, Any]] = []
        for a, b in pieces:
            if b - a < MIN_WALL_LENGTH_PX:
                continue
            out.append({**seg, "x1": a, "x2": b, "y1": y, "y2": y})
        return out

    def split_vertical(seg: dict[str, Any], x: float) -> list[dict[str, Any]]:
        lo, hi = sorted((float(seg["y1"]), float(seg["y2"])))
        pieces: list[tuple[float, float]] = []
        if lo < cmin_y - 1:
            pieces.append((lo, min(hi, cmin_y)))
        if hi > cmax_y + 1:
            pieces.append((max(lo, cmax_y), hi))
        out: list[dict[str, Any]] = []
        for a, b in pieces:
            if b - a < MIN_WALL_LENGTH_PX:
                continue
            out.append({**seg, "y1": a, "y2": b, "x1": x, "x2": x})
        return out

    trimmed: list[dict[str, Any]] = []
    dropped = 0
    for seg in walls:
        x1, y1 = float(seg["x1"]), float(seg["y1"])
        x2, y2 = float(seg["x2"]), float(seg["y2"])
        horizontal = abs(y2 - y1) < 1e-6
        if horizontal:
            y = y1
            on_south = abs(y - max_y) <= edge_tol
            on_north = abs(y - min_y) <= edge_tol
            overlaps_x = min(x1, x2) < cmax_x - 2 and max(x1, x2) > cmin_x + 2
            if (on_south or on_north) and overlaps_x:
                parts = split_horizontal(seg, y)
                dropped += 1 - len(parts)
                trimmed.extend(parts)
                continue
        else:
            x = x1
            on_east = abs(x - max_x) <= edge_tol
            on_west = abs(x - min_x) <= edge_tol
            overlaps_y = min(y1, y2) < cmax_y - 2 and max(y1, y2) > cmin_y + 2
            if (on_east or on_west) and overlaps_y:
                parts = split_vertical(seg, x)
                dropped += 1 - len(parts)
                trimmed.extend(parts)
                continue
        trimmed.append(seg)

    if dropped:
        logger.info("Car-porch cutout: trimmed %d AABB-edge wall(s)", dropped)
    return trimmed


def filter_openings_to_house_bounds(
    openings: list[Detection],
    bounds: dict[str, float] | None,
    *,
    pad_px: float = 60.0,
) -> list[Detection]:
    """
    Drop openings that fall outside the real house footprint.

    Title blocks and legend keys near the sheet margin produce phantom D/W
    tags; anchoring to the wall bounding box removes them so the surviving
    openings sit inside actual doorways.
    """
    if not bounds or not openings:
        return openings

    min_x = bounds["min_x"] - pad_px
    max_x = bounds["max_x"] + pad_px
    min_y = bounds["min_y"] - pad_px
    max_y = bounds["max_y"] + pad_px

    kept = [
        o
        for o in openings
        if min_x <= (o.box.xmin + o.box.xmax) / 2.0 <= max_x
        and min_y <= (o.box.ymin + o.box.ymax) / 2.0 <= max_y
    ]
    dropped = len(openings) - len(kept)
    if dropped:
        logger.info(
            "House-bounds filter: dropped %d opening(s) outside the footprint",
            dropped,
        )
    return kept


def _drop_staircase_segments(
    segments: list[dict[str, Any]],
    *,
    max_spacing: float = STAIR_STEP_MAX_SPACING_PX,
    min_lines: int = STAIR_MIN_STEP_LINES,
) -> list[dict[str, Any]]:
    """
    Remove tightly spaced parallel strokes that form staircase treads.

    Stair symbols draw many parallel lines a few pixels apart; OpenCV treats
    each tread as a wall segment. A cluster of ``min_lines`` or more parallel
    strokes within ``max_spacing`` is discarded as hatching, not masonry.
    """
    if len(segments) < min_lines:
        return segments

    orient_groups: dict[str, list[dict[str, Any]]] = {}
    for seg in segments:
        x1, y1 = float(seg["x1"]), float(seg["y1"])
        x2, y2 = float(seg["x2"]), float(seg["y2"])
        horizontal = abs(x2 - x1) >= abs(y2 - y1)
        orient_groups.setdefault("h" if horizontal else "v", []).append(seg)

    drop: set[int] = set()

    for axis, group in orient_groups.items():
        horizontal = axis == "h"

        def perp_pos(seg: dict[str, Any]) -> float:
            if horizontal:
                return (float(seg["y1"]) + float(seg["y2"])) / 2.0
            return (float(seg["x1"]) + float(seg["x2"])) / 2.0

        sorted_segs = sorted(group, key=perp_pos)
        idx = 0
        while idx < len(sorted_segs):
            cluster = [sorted_segs[idx]]
            nxt = idx + 1
            while nxt < len(sorted_segs):
                gap = perp_pos(sorted_segs[nxt]) - perp_pos(sorted_segs[nxt - 1])
                if gap > max_spacing:
                    break
                cluster.append(sorted_segs[nxt])
                nxt += 1
            if len(cluster) >= min_lines:
                for seg in cluster:
                    drop.add(id(seg))
            idx = nxt if nxt > idx + 1 else idx + 1

    if not drop:
        return segments

    kept = [seg for seg in segments if id(seg) not in drop]
    logger.info(
        "Staircase filter: dropped %d tread line(s), %d wall segment(s) remain",
        len(segments) - len(kept),
        len(kept),
    )
    return kept


def extract_room_boundary_walls(
    image: np.ndarray,
    *,
    thickness: int = int(WALL_SEGMENT_THICKNESS_PX),
    min_room_area: int = ROOM_MIN_AREA_PX,
) -> list[dict[str, int]]:
    """
    Hybrid wall extractor for scanned architectural plans.

    Pipeline
    --------
    1. Adaptive Gaussian threshold (BINARY_INV) — survives gray paper / glare
    2. Morphological open/close — drop text noise, seal wall gaps
    3. Thick-wall contour centreline extraction (exterior + partitions)
    4. Room-polygon boundaries from enclosed white spaces
    5. HoughLinesP on wall ink for remaining long strokes (fill-in only)
    6. Consolidate collinear fragments into solid wall centrelines
    """
    if image.ndim == 2:
        gray = image
    else:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]
    img_area = float(h * w)

    ink = _build_scanned_ink_mask(gray)
    thick = _thick_wall_mask(ink)
    # Prefer thick mask; fall back to raw ink if morphology wiped everything
    wall_mask = thick if float(cv2.countNonZero(thick)) > img_area * 0.002 else ink

    walls: list[dict[str, int]] = []
    seen: set[tuple[tuple[float, float], tuple[float, float]]] = set()

    def merge(segments: list[dict[str, int]]) -> int:
        added = 0
        for seg in segments:
            if _append_unique_segment(
                walls,
                seen,
                seg["x1"],
                seg["y1"],
                seg["x2"],
                seg["y2"],
                int(seg.get("thickness") or thickness),
            ):
                added += 1
        return added

    n_contour = merge(
        _segments_from_wall_contours(wall_mask, thickness=thickness, img_area=img_area)
    )
    n_rooms = merge(
        _segments_from_room_polygons(
            ink, thickness=thickness, min_room_area=min_room_area
        )
    )
    n_hough = 0
    # Hough only fills gaps — avoids a maze of overlapping sticks on dense plans
    if n_contour + n_rooms < 12:
        dilated = cv2.dilate(
            wall_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1
        )
        n_hough = merge(_segments_from_hough(dilated, thickness=thickness))
        if n_contour + n_rooms + n_hough < 6:
            edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 140)
            n_hough += merge(_segments_from_hough(edges, thickness=thickness))

    before = len(walls)
    # Safety net: drop any sheet-frame line that slipped through a source pass
    walls = _drop_sheet_border_segments(walls, w, h)
    # Force the orthogonal grid before merging so collinear tests are exact
    walls = _orthogonalize_segments(walls)
    walls = _merge_double_wall_centrelines(walls)
    walls = _merge_near_duplicate_walls(walls)
    walls = _drop_staircase_segments(walls)
    # Fuse collinear fragments so a wall run is one solid centreline
    walls = consolidate_wall_segments(walls)
    # Consolidation can re-create a full-width run along a margin — re-filter
    walls = _drop_sheet_border_segments(walls, w, h)
    # Finally make the layout watertight: shared grid lines, bridged holes,
    # then closed corners. Nothing is filled along the bounding box, so a
    # concave footprint keeps its car porch cutout.
    walls = _snap_segments_to_grid(walls)
    walls = _bridge_collinear_gaps(walls)
    walls = _weld_segment_corners(walls)
    walls = _collapse_coplanar_segments(walls)
    walls = _weld_segment_corners(walls)

    bounds = house_bounds_from_walls(walls)
    cutout = None
    if bounds is not None:
        cutout = _cutout_from_outside(_mark_outside_pixels(ink), bounds)
        if cutout:
            walls = _trim_walls_to_cutout(walls, bounds, cutout)
            walls = _weld_segment_corners(walls)
            bounds = house_bounds_from_walls(walls)
            if bounds is not None:
                bounds["cutout"] = {
                    "min_x": round(cutout["min_x"], 2),
                    "min_y": round(cutout["min_y"], 2),
                    "max_x": round(cutout["max_x"], 2),
                    "max_y": round(cutout["max_y"], 2),
                    "corner": cutout["corner"],
                }

    extract_room_boundary_walls.last_cutout = (  # type: ignore[attr-defined]
        bounds.get("cutout") if bounds else None
    )
    logger.info(
        "Scanned wall extractor: %d walls (raw=%d; contour=%d, room-poly=%d, "
        "hough=%d) on %dx%d — house bounds %s cutout=%s",
        len(walls),
        before,
        n_contour,
        n_rooms,
        n_hough,
        w,
        h,
        bounds,
        cutout.get("corner") if cutout else None,
    )
    return walls


def extract_wall_lines(
    image: np.ndarray,
    *,
    thickness: int = int(WALL_SEGMENT_THICKNESS_PX),
) -> list[dict[str, int]]:
    """
    Extract exterior + interior wall segments for the 3D viewport.

    Uses the scanned-blueprint hybrid pipeline (adaptive threshold + Hough + rooms).
    """
    return extract_room_boundary_walls(image, thickness=thickness)


def _bbox_from_wall_segment(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    thickness: float,
    img_w: int,
    img_h: int,
) -> BoundingBox:
    """Axis-aligned bounding box padded perpendicular to the dominant run axis."""
    pad = max(thickness / 2.0, 1.0)
    xmin, xmax = sorted((x1, x2))
    ymin, ymax = sorted((y1, y2))
    if abs(x2 - x1) >= abs(y2 - y1):
        ymin -= pad
        ymax += pad
    else:
        xmin -= pad
        xmax += pad
    return BoundingBox(xmin, ymin, xmax, ymax).clip(img_w, img_h)


def _wall_aligns_with_column(
    wall: BoundingBox, columns: list[Detection]
) -> bool:
    """True when a column footprint intersects an expanded wall corridor."""
    expanded = BoundingBox(
        wall.xmin - COLUMN_ALIGN_PAD_PX,
        wall.ymin - COLUMN_ALIGN_PAD_PX,
        wall.xmax + COLUMN_ALIGN_PAD_PX,
        wall.ymax + COLUMN_ALIGN_PAD_PX,
    )
    return any(expanded.intersection(col.box) is not None for col in columns)


def wall_detections_from_extracted_lines(
    segments: list[dict[str, Any]],
    columns: list[Detection] | None = None,
    canvas: int = CANVAS_SIZE,
) -> list[dict[str, Any]]:
    """
    Promote room-boundary segments into full wall detection payloads for the API
    and 3D viewport (bbox, thickness, centreline endpoints, classification).
    """
    columns = columns or []
    walls: list[dict[str, Any]] = []

    for idx, seg in enumerate(segments, start=1):
        x1 = float(seg["x1"])
        y1 = float(seg["y1"])
        x2 = float(seg["x2"])
        y2 = float(seg["y2"])
        thickness_px = float(seg.get("thickness") or WALL_SEGMENT_THICKNESS_PX)
        thickness_m = thickness_px / PX_PER_METER

        box = _bbox_from_wall_segment(
            x1, y1, x2, y2, thickness_px, canvas, canvas
        )
        if box.area <= 0:
            continue

        aligns_with_column = _wall_aligns_with_column(box, columns)
        is_load_bearing = (
            thickness_m >= LOAD_BEARING_THICKNESS_M or aligns_with_column
        )
        wall_type = "LOAD_BEARING" if is_load_bearing else "PARTITION"
        perc = _box_to_percent(box, canvas, canvas)

        walls.append(
            {
                "id": f"WALL-{idx:02d}",
                "label": (
                    f"{'Load-Bearing' if is_load_bearing else 'Partition'} Wall {idx}"
                ),
                "confidence": 72.0 if is_load_bearing else 68.0,
                "bbox": box.as_xyxy(),
                "top": perc["top"],
                "left": perc["left"],
                "width": perc["width"],
                "height": perc["height"],
                "source": "architectural",
                "kind": "wall",
                "wall_type": wall_type,
                "thickness_m": round(thickness_m, 3),
                "thickness_px": round(thickness_px, 1),
                "thickness": int(round(thickness_px)),
                "aligns_with_column": aligns_with_column,
                "orientation": (
                    "horizontal" if abs(x2 - x1) >= abs(y2 - y1) else "vertical"
                ),
                "x1": round(x1, 2),
                "y1": round(y1, 2),
                "x2": round(x2, 2),
                "y2": round(y2, 2),
            }
        )

    walls.sort(
        key=lambda item: (
            0 if item["wall_type"] == "LOAD_BEARING" else 1,
            -float(item.get("thickness_m") or 0),
        )
    )
    return walls


# ---------------------------------------------------------------------------
# OpenCV — structural columns
# ---------------------------------------------------------------------------


def detect_structural_columns(struct_image: np.ndarray) -> list[Detection]:
    """
    Detect solid column symbols on a structural blueprint with classic CV.

    Pipeline
    --------
    1. ``cv2.cvtColor`` → grayscale
    2. ``cv2.adaptiveThreshold`` (BINARY_INV) to isolate filled black shapes
    3. Morphological close to fill hatched column interiors
    4. ``cv2.findContours`` + aspect-ratio / area filters for square-ish columns
    """
    # 1) Grayscale
    gray = cv2.cvtColor(struct_image, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    img_area = float(h * w)

    # 2) Adaptive threshold — dark ink becomes white foreground
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=8,
    )

    # Also try a hard Otsu pass and OR the masks — catches solid filled columns
    # that adaptive threshold may fragment.
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    combined = cv2.bitwise_or(binary, otsu)

    # 3) Morphological close — seal gaps inside hatched column symbols
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 4) Contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    detections: list[Detection] = []
    col_idx = 0

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = float(bw * bh)
        area_ratio = area / img_area

        if area_ratio < MIN_COLUMN_AREA_RATIO or area_ratio > MAX_COLUMN_AREA_RATIO:
            continue

        aspect = bw / max(bh, 1)
        if aspect < MIN_COLUMN_ASPECT or aspect > MAX_COLUMN_ASPECT:
            continue

        # Prefer compact polygons (columns) over long wall runs
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
        if len(approx) < 4 or len(approx) > 10:
            continue

        hull_area = float(cv2.contourArea(cv2.convexHull(contour)))
        extent = area / max(hull_area, 1.0)
        confidence = float(np.clip(55 + extent * 40, 55, 98))

        col_idx += 1
        detections.append(
            Detection(
                id=f"C{col_idx}",
                label=f"Column C{col_idx}",
                confidence=round(confidence, 1),
                box=BoundingBox(float(x), float(y), float(x + bw), float(y + bh)),
                source="structural",
            )
        )

    detections.sort(key=lambda d: d.confidence, reverse=True)
    # Re-index after sort so C1 is the highest-confidence column
    renumbered: list[Detection] = []
    for i, det in enumerate(detections[:20], start=1):
        renumbered.append(
            Detection(
                id=f"C{i}",
                label=f"Column C{i}",
                confidence=det.confidence,
                box=det.box,
                source=det.source,
            )
        )
    return renumbered


# ---------------------------------------------------------------------------
# Geometric clash detection
# ---------------------------------------------------------------------------


def find_clashes(
    openings: list[Detection],
    columns: list[Detection],
) -> list[dict[str, Any]]:
    """
    Flag column ↔ door/window intersections.

    Severity
    --------
    - CRITICAL — overlap ratio ≥ 30%
    - WARNING  — overlap ratio ≥ 8%
    """
    clashes: list[dict[str, Any]] = []
    clash_counter = 0

    for opening in openings:
        for column in columns:
            iou = compute_iou(opening.box, column.box)
            overlap = compute_overlap_ratio(opening.box, column.box)
            score = max(iou, overlap)

            if score < OVERLAP_WARNING:
                continue

            clash_counter += 1
            severity = "CRITICAL" if score >= OVERLAP_CRITICAL else "WARNING"
            clash_id = f"CLASH-{clash_counter:02d}"
            inter = opening.box.intersection(column.box)
            inter_xyxy = inter.as_xyxy() if inter else None

            title = f"{column.label} blocking {opening.label}"
            description = (
                f"Structural {column.label} intersects architectural "
                f"{opening.label} "
                f"(IoU={iou:.2f}, overlap={overlap:.0%}). "
                + (
                    "Immediate redesign required — load path conflicts with opening."
                    if severity == "CRITICAL"
                    else "Review clearance; minor geometric conflict detected."
                )
            )

            clashes.append(
                {
                    "clash_id": clash_id,
                    "id": f"{clash_counter:02d}",  # frontend-compatible short id
                    "title": title,
                    "severity": severity,
                    "description": description,
                    "coordinates": {
                        "column_bbox": column.box.as_xyxy(),
                        "opening_bbox": opening.box.as_xyxy(),
                        "intersection_bbox": inter_xyxy,
                    },
                    "iou": round(iou, 4),
                    "overlap_ratio": round(overlap, 4),
                    "opening_id": opening.id,
                    "column_id": column.id,
                }
            )

    clashes.sort(
        key=lambda c: (0 if c["severity"] == "CRITICAL" else 1, -c["iou"])
    )
    return clashes


# ---------------------------------------------------------------------------
# End-to-end pipeline
# ---------------------------------------------------------------------------


def detect_clashes(
    arch_image_path: str | Path,
    struct_image_path: str | Path | None = None,
) -> dict[str, Any]:
    """
    Dual-blueprint clash detection entry point.

    When ``struct_image_path`` is None, the Generative Structural Layout (GSL)
    engine synthesizes clash-free columns from architectural walls/openings.
    """
    # --- 1) Load ----------------------------------------------------------------
    arch_raw = _load_image(arch_image_path)
    struct_raw = (
        _load_image(struct_image_path) if struct_image_path is not None else None
    )

    # --- 2) Align to shared 1024×1024 coordinate frame --------------------------
    arch_aligned = align_to_canvas(arch_raw, CANVAS_SIZE)
    struct_aligned = (
        align_to_canvas(struct_raw, CANVAS_SIZE) if struct_raw is not None else None
    )
    logger.info(
        "Registered blueprints to %dx%d canvas (arch=%s, struct=%s)",
        CANVAS_SIZE,
        CANVAS_SIZE,
        getattr(arch_raw, "shape", None),
        getattr(struct_raw, "shape", None) if struct_raw is not None else "GSL",
    )

    # --- 3) Consolidated wall centrelines (needed to place openings) -----------
    from app.services.architectural_audit import run_architectural_audit

    raw_wall_lines = extract_room_boundary_walls(arch_aligned)
    # True footprint of the house with the drawing-sheet frame already removed;
    # everything downstream is aligned to this centre, not the canvas centre.
    house_bounds = house_bounds_from_walls(raw_wall_lines)
    cutout = getattr(extract_room_boundary_walls, "last_cutout", None)
    if house_bounds is not None and cutout:
        house_bounds["cutout"] = cutout
    provisional_columns: list[Detection] = []
    wall_detections = wall_detections_from_extracted_lines(
        raw_wall_lines, columns=provisional_columns, canvas=CANVAS_SIZE
    )

    # --- 4) Architectural openings: YOLOv8, wall-context split, symbol fallback -
    openings = detect_architectural_openings(arch_aligned)
    openings = filter_openings_to_house_bounds(openings, house_bounds)
    openings = reclassify_openings(
        openings, raw_wall_lines, arch_aligned, house_bounds
    )

    has_doors = any(o.id.startswith("D") for o in openings)
    has_windows = any(o.id.startswith("W") for o in openings)

    if not has_doors or not has_windows:
        symbol_openings = detect_opening_symbols(
            arch_aligned, raw_wall_lines, canvas=CANVAS_SIZE
        )
        # Trust YOLO + reclassification for whichever class is already present.
        fill_in = [
            o
            for o in symbol_openings
            if (o.id.startswith("D") and not has_doors)
            or (o.id.startswith("W") and not has_windows)
        ]
        if fill_in:
            openings = reclassify_openings(
                openings + fill_in, raw_wall_lines, arch_aligned, house_bounds
            )
            logger.info(
                "Opening fallback added %d opening(s) — %d total after reclassify",
                len(fill_in),
                len(openings),
            )

    openings = dedupe_openings_nms(openings)

    # --- 5) Columns: OpenCV structural plan OR Generative Structural Layout -----
    ai_generated = False
    if struct_aligned is not None:
        columns = detect_structural_columns(struct_aligned)
    else:
        from app.services.generative_structural_layout import generate_structural_grid

        columns = generate_structural_grid(wall_detections, openings, canvas=CANVAS_SIZE)
        ai_generated = True
        # Re-classify walls now that we have AI column positions for alignment
        wall_detections = wall_detections_from_extracted_lines(
            raw_wall_lines, columns=columns, canvas=CANVAS_SIZE
        )

    # --- 6) Geometric clash calculation -----------------------------------------
    clashes = find_clashes(openings, columns)

    # --- 7) Closed-loop GCR (skip / empty when GSL already clash-free) ----------
    recommendations = [
        build_verified_gcr_recommendation(c, i + 1)
        for i, c in enumerate(clashes[:6])
    ]

    # --- 8) Passive design audit -------------------------------------------------
    audit = run_architectural_audit(
        arch_aligned, openings, columns, canvas=CANVAS_SIZE
    )
    # Keep room-polygon walls — audit classifier often rejects sparse plans.
    if not wall_detections and audit.get("walls"):
        wall_detections = audit["walls"]

    # Leave wall centrelines intact. The 3D viewport carves door/window holes
    # when it extrudes; splitting them here left remnant stubs that the
    # snapper treated as walls, so doors ended up standing in the room.

    architectural_detections = [
        _detection_payload(d, CANVAS_SIZE) for d in openings
    ]
    structural_detections = []
    for d in columns:
        payload = _detection_payload(d, CANVAS_SIZE)
        payload["kind"] = "column"
        if ai_generated:
            payload["is_ai_generated"] = True
            payload["label"] = d.label if d.label.startswith("AI") else f"AI {d.label}"
        structural_detections.append(payload)

    combined = architectural_detections + structural_detections + wall_detections

    model_name = (
        "yolov8_architect+ai_gsl"
        if ai_generated
        else (
            "yolov8_architect+opencv_columns"
            if YOLO_WEIGHTS_PATH.is_file()
            else "yolov8n-fallback+opencv_columns"
        )
    )

    return {
        "image_width": CANVAS_SIZE,
        "image_height": CANVAS_SIZE,
        "architectural_detections": architectural_detections,
        "structural_detections": structural_detections,
        "walls": wall_detections,
        "house_bounds": house_bounds,
        "clashes": [
            {
                "clash_id": c["clash_id"],
                "id": c["id"],
                "title": c["title"],
                "severity": c["severity"],
                "description": c["description"],
                "coordinates": c["coordinates"],
                "iou": c["iou"],
                "overlap_ratio": c["overlap_ratio"],
                "opening_id": c["opening_id"],
                "column_id": c["column_id"],
            }
            for c in clashes
        ],
        "recommendations": recommendations,
        "architectural_audit": {
            "wall_classifications": audit["wall_classifications"],
            "cross_ventilation": audit["cross_ventilation"],
            "solar_gain": audit["solar_gain"],
        },
        "detections": combined,
        "model": model_name,
        "elements_detected": len(combined),
        "is_ai_generated": ai_generated,
        "meta": {
            "openings_count": len(openings),
            "columns_count": len(columns),
            "clashes_count": len(clashes),
            "walls_count": len(wall_detections),
            "canvas_width": CANVAS_SIZE,
            "canvas_height": CANVAS_SIZE,
            "image_width": CANVAS_SIZE,
            "image_height": CANVAS_SIZE,
            "house_bounds": house_bounds,
            "registration": f"{CANVAS_SIZE}x{CANVAS_SIZE}",
            "job_id": str(uuid.uuid4()),
            "generative_structural_layout": ai_generated,
        },
    }


def generate_structural_grid(
    walls: list[Any],
    openings: list[Detection],
    canvas: int = CANVAS_SIZE,
) -> list[Detection]:
    """
    Public alias for the AI-GSL engine (see ``generative_structural_layout``).

    Places columns at wall corners / junctions, clears openings, and inserts
    intermediate posts so bay spacing stays within ~3–5 m.
    """
    from app.services.generative_structural_layout import (
        generate_structural_grid as _generate,
    )

    return _generate(walls, openings, canvas=canvas)
