"""
Component 2 — Hybrid Architectural Validation Pipeline
======================================================

1. YOLOv8 detects doors / windows / openings on the architectural plan.
2. Classic OpenCV (threshold + contours) extracts solid column symbols
   from the structural plan.
3. Both canvases are registered to a shared 1024×1024 coordinate frame.
4. Bounding-box overlap (IoU / intersection ratio) flags geometric clashes.
"""

from __future__ import annotations

import logging
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
    """
    model = get_yolo_model()
    results = model.predict(source=arch_image, conf=0.25, verbose=False)

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
    edges = cv2.Canny(blur, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = image.shape[:2]
    img_area = float(h * w)
    detections: list[Detection] = []
    door_idx = 0
    window_idx = 0

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = float(bw * bh)
        if area < img_area * 0.002 or area > img_area * 0.12:
            continue
        aspect = bw / max(bh, 1)

        if 0.25 <= aspect <= 0.7:
            door_idx += 1
            label, conf, det_id = f"Door D{door_idx}", 72.0, f"D{door_idx}"
        elif 1.2 <= aspect <= 4.0:
            window_idx += 1
            label, conf, det_id = f"Window W{window_idx}", 68.0, f"W{window_idx}"
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
    return detections[:12]


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

    # --- 3) YOLOv8 architectural openings ---------------------------------------
    openings = detect_architectural_openings(arch_aligned)

    # --- 4) Walls first (needed by GSL + audit) ---------------------------------
    from app.services.architectural_audit import (
        detect_and_classify_walls,
        run_architectural_audit,
    )

    # Temporary empty columns for wall classification alignment check
    provisional_columns: list[Detection] = []
    wall_detections = detect_and_classify_walls(
        arch_aligned, provisional_columns, canvas=CANVAS_SIZE
    )

    # --- 5) Columns: OpenCV structural plan OR Generative Structural Layout -----
    ai_generated = False
    if struct_aligned is not None:
        columns = detect_structural_columns(struct_aligned)
    else:
        from app.services.generative_structural_layout import generate_structural_grid

        columns = generate_structural_grid(wall_detections, openings, canvas=CANVAS_SIZE)
        ai_generated = True
        # Re-classify walls now that we have AI column positions for alignment
        wall_detections = detect_and_classify_walls(
            arch_aligned, columns, canvas=CANVAS_SIZE
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
    # Prefer freshly classified walls from audit when available
    if audit.get("walls"):
        wall_detections = audit["walls"]

    # Boolean subtraction: leave physical gaps where YOLO doors/windows sit so
    # extruded masonry never blocks openings in the 3D viewport.
    wall_detections = subtract_openings_from_walls(
        wall_detections, openings, canvas=CANVAS_SIZE
    )

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
        "architectural_detections": architectural_detections,
        "structural_detections": structural_detections,
        "walls": wall_detections,
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
