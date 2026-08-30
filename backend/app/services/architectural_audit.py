"""
AI-Driven Passive Design & Structural Integrity Audits (Component 2).

1. Structural Wall Classifier — thickness + column alignment → LOAD_BEARING | PARTITION
2. Passive Cross-Ventilation Analyzer — opposite openings per room contour
3. Solar Orientation & Heat Gain Predictor — west-facing living-area windows
"""

from __future__ import annotations

import logging
import math
from typing import Any

import cv2
import numpy as np

from app.services.clash_detection import (
    CANVAS_SIZE,
    BoundingBox,
    Detection,
    _box_to_percent,
    _is_sheet_border_contour,
    _is_sheet_border_segment,
)

logger = logging.getLogger(__name__)

# Scale: registered canvas ≈ 100 px / meter (matches GCR prescription scale).
PX_PER_METER = 100.0
# 9 inches ≈ 0.2286 m → load-bearing thickness threshold
LOAD_BEARING_THICKNESS_M = 0.23
LOAD_BEARING_THICKNESS_PX = LOAD_BEARING_THICKNESS_M * PX_PER_METER  # ≈ 23 px
COLUMN_ALIGN_PAD_PX = 28.0  # proximity for wall↔column structural alignment

# Ghost-wall filter: dimension/grid/text strokes are 1–2 px; real masonry ink is thicker.
# Anchored to the 1024 canvas; scales if a different registration size is used.
MIN_WALL_THICKNESS_PX = 6.0
_MIN_WALL_THICKNESS_REF_CANVAS = 1024.0


def _min_wall_thickness_px(img_w: int, img_h: int) -> float:
    """Resolution-aware thickness floor (6 px @ 1024, scales with the longer side)."""
    scale = max(img_w, img_h) / _MIN_WALL_THICKNESS_REF_CANVAS
    return max(4.0, MIN_WALL_THICKNESS_PX * scale)


def _contour_centerline(
    contour: np.ndarray,
) -> tuple[float, float, float, float] | None:
    """
    True oriented centreline of a wall contour, in image pixels.

    ``cv2.minAreaRect`` recovers the real bearing of a diagonal wall, which the
    axis-aligned ``boundingRect`` destroys — a 45° wall and a square blob share
    the same AABB. The centreline runs between the midpoints of the two short
    edges, so a consumer can extrude it without guessing the orientation.
    """
    if contour is None or len(contour) < 3:
        return None
    (cx, cy), (rw, rh), angle_deg = cv2.minAreaRect(contour)
    if rw < 1e-3 and rh < 1e-3:
        return None

    length = max(rw, rh)
    # OpenCV reports the angle of the `rw` edge; the long axis is 90° off when
    # `rh` is the longer side.
    theta = math.radians(angle_deg if rw >= rh else angle_deg + 90.0)
    hx = math.cos(theta) * length / 2.0
    hy = math.sin(theta) * length / 2.0
    return (cx - hx, cy - hy, cx + hx, cy + hy)


def _endpoint_payload(
    x1: float, y1: float, x2: float, y2: float
) -> dict[str, float]:
    """Wall centreline endpoints on the registered canvas (origin top-left)."""
    return {
        "x1": round(float(x1), 2),
        "y1": round(float(y1), 2),
        "x2": round(float(x2), 2),
        "y2": round(float(y2), 2),
    }


def _axis_centerline_from_box(box: BoundingBox) -> dict[str, float]:
    """Fallback centreline along the long axis of an axis-aligned wall box."""
    if box.width >= box.height:
        cy = box.ymin + box.height / 2.0
        return _endpoint_payload(box.xmin, cy, box.xmax, cy)
    cx = box.xmin + box.width / 2.0
    return _endpoint_payload(cx, box.ymin, cx, box.ymax)


def _stroke_thickness_px(
    ink: np.ndarray,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
) -> float:
    """
    True ink width along a segment via distance-transform sampling.

    Returns ≈ 2 × median radius so thin dimension lines measure 1–2 px while
    masonry walls measure well above ``MIN_WALL_THICKNESS_PX``.
    """
    h, w = ink.shape[:2]
    length = float(np.hypot(x2 - x1, y2 - y1))
    if length < 1.0:
        return 0.0

    # Distance to nearest zero (background) — only meaningful on ink pixels.
    dist = cv2.distanceTransform(ink, cv2.DIST_L2, 3)
    n = max(5, int(length / 10.0))
    radii: list[float] = []
    for t in np.linspace(0.12, 0.88, n):
        x = int(round(x1 + t * (x2 - x1)))
        y = int(round(y1 + t * (y2 - y1)))
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if ink[y, x] == 0:
            # Nudge onto the nearest ink pixel within a small cross
            found = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (0, 2)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and ink[yy, xx] > 0:
                    radii.append(float(dist[yy, xx]))
                    found = True
                    break
            if not found:
                radii.append(0.0)
            continue
        radii.append(float(dist[y, x]))

    if not radii:
        return 0.0
    return float(2.0 * np.median(radii))


def _wall_payload(det: Detection, canvas: int, extra: dict[str, Any]) -> dict[str, Any]:
    perc = _box_to_percent(det.box, canvas, canvas)
    return {
        "id": det.id,
        "label": det.label,
        "confidence": det.confidence,
        "bbox": det.box.as_xyxy(),
        "top": perc["top"],
        "left": perc["left"],
        "width": perc["width"],
        "height": perc["height"],
        "source": "architectural",
        "kind": "wall",
        **extra,
    }


def detect_and_classify_walls(
    arch_image: np.ndarray,
    columns: list[Detection],
    canvas: int = CANVAS_SIZE,
) -> list[dict[str, Any]]:
    """
    Extract wall segments via OpenCV line / contour processing and classify
    each as LOAD_BEARING or PARTITION.

    Thin dimension / grid / text strokes (< ~6 px ink width) are rejected so
    they never become "ghost walls" in the 3D viewport.
    """
    h, w = arch_image.shape[:2]
    min_thickness = _min_wall_thickness_px(w, h)
    gray = cv2.cvtColor(arch_image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Emphasize dark wall ink on light paper
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 8
    )
    # Prefer elongated strokes (walls) over furniture blobs
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 25))
    # Purely axis-aligned openings erase 45° masonry; the diagonal structuring
    # elements keep angled walls (bay windows, splayed corridors) in the mask.
    kernel_d1 = np.eye(21, dtype=np.uint8)
    kernel_d2 = np.fliplr(kernel_d1).copy()
    walls_h = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_h)
    walls_v = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_v)
    walls_d1 = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_d1)
    walls_d2 = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_d2)
    # Undilated mask — used for true ink-width measurement (pre-pad)
    ink_mask = cv2.bitwise_or(
        cv2.bitwise_or(walls_h, walls_v), cv2.bitwise_or(walls_d1, walls_d2)
    )
    wall_mask = cv2.dilate(
        ink_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1
    )

    contours, _ = cv2.findContours(
        wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    img_area = float(h * w)
    walls: list[dict[str, Any]] = []
    idx = 0
    rejected_thin = 0

    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area = float(bw * bh)
        if area < img_area * 0.0005 or area > img_area * 0.45:
            continue
        # The printed drawing-sheet frame is not masonry
        if _is_sheet_border_contour(contour, w, h):
            continue
        # Measure elongation on the oriented rect, not the AABB: a 45° wall has
        # a square bounding box and would be rejected here as a furniture blob.
        (_, _), (rect_w, rect_h), _ = cv2.minAreaRect(contour)
        long_side = max(rect_w, rect_h)
        short_side = max(min(rect_w, rect_h), 1.0)
        aspect = long_side / short_side
        # Allow thick load-bearing runs (lower aspect) and thin partitions
        if aspect < 1.6:
            continue

        # Oriented short side is a fast reject; confirm with a stroke sample
        if short_side < min_thickness:
            rejected_thin += 1
            continue

        centerline = _contour_centerline(contour)
        if centerline is None:
            continue
        cx1, cy1, cx2, cy2 = centerline
        if _is_sheet_border_segment(cx1, cy1, cx2, cy2, w, h):
            continue

        stroke_px = _stroke_thickness_px(ink_mask, cx1, cy1, cx2, cy2)
        # Prefer measured stroke; fall back to the oriented width when empty
        thickness_px = stroke_px if stroke_px > 0.5 else short_side
        if thickness_px < min_thickness:
            rejected_thin += 1
            continue

        thickness_m = thickness_px / PX_PER_METER
        box = BoundingBox(float(x), float(y), float(x + bw), float(y + bh))

        aligns_with_column = _wall_aligns_with_column(box, columns)
        is_load_bearing = (
            thickness_m >= LOAD_BEARING_THICKNESS_M or aligns_with_column
        )
        wall_type = "LOAD_BEARING" if is_load_bearing else "PARTITION"

        idx += 1
        det = Detection(
            id=f"WALL-{idx:02d}",
            label=f"{'Load-Bearing' if is_load_bearing else 'Partition'} Wall {idx}",
            confidence=78.0 if is_load_bearing else 70.0,
            box=box,
            source="architectural",
        )
        # Oriented centreline so the 3D viewport can extrude diagonals correctly
        endpoints = _endpoint_payload(cx1, cy1, cx2, cy2)
        walls.append(
            _wall_payload(
                det,
                canvas,
                {
                    "wall_type": wall_type,
                    "thickness_m": round(thickness_m, 3),
                    "thickness_px": round(thickness_px, 1),
                    "aligns_with_column": aligns_with_column,
                    "orientation": "horizontal" if bw >= bh else "vertical",
                    **endpoints,
                },
            )
        )

    # Hough line fallback — ensures walls appear even on sparse line drawings.
    # Critical: measure true ink width *before* padding; never inflate thin
    # dimension lines into fake masonry walls.
    if len(walls) < 2:
        edges = cv2.Canny(blur, 50, 150)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=80, minLineLength=80, maxLineGap=12
        )
        if lines is not None:
            for line in lines[:40]:
                x1, y1, x2, y2 = line[0]
                length = float(np.hypot(x2 - x1, y2 - y1))
                if length < 70:
                    continue
                if _is_sheet_border_segment(
                    float(x1), float(y1), float(x2), float(y2), w, h
                ):
                    continue

                # Measure on the adaptive-threshold ink (not the dilated mask)
                thickness_px = _stroke_thickness_px(
                    binary, float(x1), float(y1), float(x2), float(y2)
                )
                if thickness_px < min_thickness:
                    rejected_thin += 1
                    continue

                # Pad only after the thickness gate so the AABB matches masonry width
                pad = max(thickness_px / 2.0, min_thickness / 2.0)
                xmin, xmax = sorted([float(x1), float(x2)])
                ymin, ymax = sorted([float(y1), float(y2)])
                if abs(x2 - x1) >= abs(y2 - y1):
                    ymin -= pad
                    ymax += pad
                else:
                    xmin -= pad
                    xmax += pad
                box = BoundingBox(xmin, ymin, xmax, ymax).clip(w, h)
                # Re-read short side after pad (must still clear the floor)
                thickness_px = max(thickness_px, float(min(box.width, box.height)))
                if float(min(box.width, box.height)) < min_thickness:
                    rejected_thin += 1
                    continue

                thickness_m = thickness_px / PX_PER_METER
                aligns_with_column = _wall_aligns_with_column(box, columns)
                is_load_bearing = (
                    thickness_m >= LOAD_BEARING_THICKNESS_M or aligns_with_column
                )
                idx += 1
                det = Detection(
                    id=f"WALL-{idx:02d}",
                    label=(
                        f"{'Load-Bearing' if is_load_bearing else 'Partition'} Wall {idx}"
                    ),
                    confidence=65.0,
                    box=box,
                    source="architectural",
                )
                walls.append(
                    _wall_payload(
                        det,
                        canvas,
                        {
                            "wall_type": (
                                "LOAD_BEARING" if is_load_bearing else "PARTITION"
                            ),
                            "thickness_m": round(thickness_m, 3),
                            "thickness_px": round(thickness_px, 1),
                            "aligns_with_column": aligns_with_column,
                            "orientation": (
                                "horizontal" if box.width >= box.height else "vertical"
                            ),
                            # Hough already gives the true segment — keep it verbatim
                            **_endpoint_payload(x1, y1, x2, y2),
                        },
                    )
                )

    if rejected_thin:
        logger.info(
            "Wall extraction rejected %d thin stroke(s) below %.1f px "
            "(dimension / grid / text ghosts)",
            rejected_thin,
            min_thickness,
        )

    walls.sort(
        key=lambda item: (
            0 if item["wall_type"] == "LOAD_BEARING" else 1,
            -item["thickness_m"],
        )
    )
    return walls[:24]


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
    for col in columns:
        if expanded.intersection(col.box) is not None:
            return True
    return False


def analyze_cross_ventilation(
    arch_image: np.ndarray,
    openings: list[Detection],
) -> dict[str, Any]:
    """
    Inspect closed room contours; PASS when a room has openings on opposite sides.
    """
    h, w = arch_image.shape[:2]
    gray = cv2.cvtColor(arch_image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = float(h * w)
    rooms: list[dict[str, Any]] = []
    room_idx = 0

    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < img_area * 0.04 or area > img_area * 0.85:
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 40 or bh < 40:
            continue
        room_idx += 1
        room_box = BoundingBox(float(x), float(y), float(x + bw), float(y + bh))

        # Openings whose centers lie inside / on the room
        room_openings: list[Detection] = []
        for op in openings:
            cx = (op.box.xmin + op.box.xmax) / 2.0
            cy = (op.box.ymin + op.box.ymax) / 2.0
            if (
                room_box.xmin - 8 <= cx <= room_box.xmax + 8
                and room_box.ymin - 8 <= cy <= room_box.ymax + 8
            ):
                room_openings.append(op)

        sides = _opening_sides(room_box, room_openings)
        has_ns = "N" in sides and "S" in sides
        has_ew = "E" in sides and "W" in sides
        passed = has_ns or has_ew

        rooms.append(
            {
                "room_id": f"ROOM-{room_idx:02d}",
                "bbox": room_box.as_xyxy(),
                "opening_ids": [o.id for o in room_openings],
                "sides_with_openings": sorted(sides),
                "CROSS_VENTILATION": "PASSED" if passed else "WARNING",
                "recommendation": (
                    None
                    if passed
                    else "Add opposite vent/window to improve airflow."
                ),
            }
        )

    # Fallback: whole-plan analysis when contour rooms are scarce
    if not rooms and openings:
        plan = BoundingBox(0.0, 0.0, float(w), float(h))
        sides = _opening_sides(plan, openings)
        passed = ("N" in sides and "S" in sides) or ("E" in sides and "W" in sides)
        rooms.append(
            {
                "room_id": "ROOM-PLAN",
                "bbox": plan.as_xyxy(),
                "opening_ids": [o.id for o in openings],
                "sides_with_openings": sorted(sides),
                "CROSS_VENTILATION": "PASSED" if passed else "WARNING",
                "recommendation": (
                    None
                    if passed
                    else "Add opposite vent/window to improve airflow."
                ),
            }
        )

    any_pass = any(r["CROSS_VENTILATION"] == "PASSED" for r in rooms)
    any_warn = any(r["CROSS_VENTILATION"] == "WARNING" for r in rooms)

    if any_pass and not any_warn:
        status = "PASSED"
        recommendation = None
    elif any_pass and any_warn:
        status = "WARNING"
        recommendation = (
            "Some rooms lack opposite openings. "
            "Add opposite vent/window to improve airflow."
        )
    elif any_warn:
        status = "WARNING"
        recommendation = "Add opposite vent/window to improve airflow."
    else:
        status = "WARNING"
        recommendation = "Add opposite vent/window to improve airflow."

    return {
        "CROSS_VENTILATION": status,
        "status": status,
        "rooms": rooms[:8],
        "recommendation": recommendation,
        "summary": (
            f"{sum(1 for r in rooms if r['CROSS_VENTILATION'] == 'PASSED')} / "
            f"{len(rooms)} rooms pass cross-ventilation"
        ),
    }


def _opening_sides(
    room: BoundingBox, openings: list[Detection]
) -> set[str]:
    """
    Assign each opening to the nearest room edge.

    Image convention (North-up): top=N, bottom=S, left=W, right=E.
    """
    sides: set[str] = set()
    if not openings:
        return sides

    rw = max(room.width, 1.0)
    rh = max(room.height, 1.0)
    # Band thickness: 28% of room dimension toward each edge
    band_x = rw * 0.28
    band_y = rh * 0.28

    for op in openings:
        cx = (op.box.xmin + op.box.xmax) / 2.0
        cy = (op.box.ymin + op.box.ymax) / 2.0
        dist = {
            "N": abs(cy - room.ymin),
            "S": abs(cy - room.ymax),
            "W": abs(cx - room.xmin),
            "E": abs(cx - room.xmax),
        }
        nearest = min(dist, key=dist.get)  # type: ignore[arg-type]
        # Require the opening to sit near that edge
        if nearest in ("N", "S") and dist[nearest] <= band_y:
            sides.add(nearest)
        elif nearest in ("E", "W") and dist[nearest] <= band_x:
            sides.add(nearest)
        else:
            sides.add(nearest)  # still count dominant side
    return sides


def analyze_solar_gain(
    openings: list[Detection],
    canvas: int = CANVAS_SIZE,
) -> dict[str, Any]:
    """
    North-up solar orientation check.

    West façade = left side of the image. Flag HIGH_WEST_EXPOSURE when major
    living-area windows face west (afternoon heat gain).
    """
    windows = [
        o
        for o in openings
        if "window" in o.label.lower() or o.id.upper().startswith("W")
    ]
    # Living-area heuristic: larger openings + labels mentioning living/kitchen,
    # or windows in the central/southern living band of the plan.
    living_keywords = ("living", "kitchen", "lounge", "dining", "family")

    west_living: list[dict[str, Any]] = []
    west_band = canvas * 0.28  # western 28% of plan

    for win in windows:
        cx = (win.box.xmin + win.box.xmax) / 2.0
        cy = (win.box.ymin + win.box.ymax) / 2.0
        label_l = win.label.lower()
        is_living_label = any(k in label_l for k in living_keywords)
        # Southern / central living zone (exclude far-north service strip)
        in_living_zone = cy >= canvas * 0.25
        is_major = win.box.area >= (canvas * canvas) * 0.0015
        faces_west = cx <= west_band

        if faces_west and (is_living_label or (in_living_zone and is_major)):
            west_living.append(
                {
                    "id": win.id,
                    "label": win.label,
                    "bbox": win.box.as_xyxy(),
                    "facing": "WEST",
                }
            )

    if west_living:
        return {
            "SOLAR_GAIN": "HIGH_WEST_EXPOSURE",
            "status": "HIGH_WEST_EXPOSURE",
            "orientation": "NORTH_UP",
            "west_facing_living_windows": west_living,
            "recommendation": "High afternoon heat. Add solar shading/louvers.",
            "summary": (
                f"{len(west_living)} living-area window(s) face West — "
                "high afternoon solar heat gain"
            ),
        }

    return {
        "SOLAR_GAIN": "OK",
        "status": "OK",
        "orientation": "NORTH_UP",
        "west_facing_living_windows": [],
        "recommendation": None,
        "summary": "No major west-facing living-area windows detected",
    }


def run_architectural_audit(
    arch_image: np.ndarray,
    openings: list[Detection],
    columns: list[Detection],
    canvas: int = CANVAS_SIZE,
) -> dict[str, Any]:
    """Run all three passive-design / structural audits."""
    walls = detect_and_classify_walls(arch_image, columns, canvas=canvas)
    ventilation = analyze_cross_ventilation(arch_image, openings)
    solar = analyze_solar_gain(openings, canvas=canvas)

    load_bearing = sum(1 for w in walls if w.get("wall_type") == "LOAD_BEARING")
    partition = sum(1 for w in walls if w.get("wall_type") == "PARTITION")

    return {
        "walls": walls,
        "wall_classifications": {
            "load_bearing_count": load_bearing,
            "partition_count": partition,
            "thickness_threshold_m": LOAD_BEARING_THICKNESS_M,
            "items": [
                {
                    "id": w["id"],
                    "wall_type": w["wall_type"],
                    "thickness_m": w["thickness_m"],
                    "aligns_with_column": w["aligns_with_column"],
                    "label": w["label"],
                }
                for w in walls
            ],
        },
        "cross_ventilation": ventilation,
        "solar_gain": solar,
    }
