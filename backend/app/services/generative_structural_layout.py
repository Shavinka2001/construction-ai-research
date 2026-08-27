"""
AI-Driven Generative Structural Layout (GSL) Engine.

When no structural blueprint is uploaded, synthesize a clash-free column grid
from architectural walls and openings:

  1. Wall corners / L / T / X junctions → primary column candidates
  2. Reject any candidate that intersects a door/window clear opening
  3. Enforce 3–5 m spacing along long wall spans (insert intermediate columns)
"""

from __future__ import annotations

import logging
import math
from typing import Any, Iterable, Sequence

from app.services.clash_detection import (
    CANVAS_SIZE,
    BoundingBox,
    Detection,
)

logger = logging.getLogger(__name__)

# Match GCR / audit scale: ≈ 100 px per meter on the 1024 canvas
PX_PER_M = 100.0
# Structurally safe bay spacing (meters → pixels)
MIN_SPACING_M = 3.0
MAX_SPACING_M = 5.0
MIN_SPACING_PX = MIN_SPACING_M * PX_PER_M  # 300
MAX_SPACING_PX = MAX_SPACING_M * PX_PER_M  # 500
# Default AI column footprint (~350 mm square)
COLUMN_HALF = 18.0  # px → ~0.36 m full width
OPENING_CLEARANCE_PX = 28.0
CORNER_MERGE_PX = 36.0


def _point_in_expanded_box(
    x: float, y: float, box: BoundingBox, pad: float
) -> bool:
    return (
        box.xmin - pad <= x <= box.xmax + pad
        and box.ymin - pad <= y <= box.ymax + pad
    )


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _cluster_points(
    points: Sequence[tuple[float, float]], merge_dist: float
) -> list[tuple[float, float]]:
    """Greedy spatial merge — nearby junction votes collapse to one seed."""
    clusters: list[list[tuple[float, float]]] = []
    for p in points:
        placed = False
        for cluster in clusters:
            cx = sum(q[0] for q in cluster) / len(cluster)
            cy = sum(q[1] for q in cluster) / len(cluster)
            if _dist(p, (cx, cy)) <= merge_dist:
                cluster.append(p)
                placed = True
                break
        if not placed:
            clusters.append([p])
    return [
        (
            sum(q[0] for q in c) / len(c),
            sum(q[1] for q in c) / len(c),
        )
        for c in clusters
    ]


def _wall_corners(wall: dict[str, Any] | BoundingBox) -> list[tuple[float, float]]:
    if isinstance(wall, BoundingBox):
        box = wall
    else:
        bbox = wall.get("bbox") or wall.get("xyxy") or []
        if len(bbox) < 4:
            return []
        box = BoundingBox(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    return [
        (box.xmin, box.ymin),
        (box.xmax, box.ymin),
        (box.xmax, box.ymax),
        (box.xmin, box.ymax),
    ]


def _wall_box(wall: dict[str, Any] | BoundingBox) -> BoundingBox | None:
    if isinstance(wall, BoundingBox):
        return wall
    bbox = wall.get("bbox") or wall.get("xyxy") or []
    if len(bbox) < 4:
        return None
    return BoundingBox(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))


def _wall_axis_points(box: BoundingBox) -> list[tuple[float, float]]:
    """
    Intermediate column seeds along a wall centerline at ~MAX_SPACING intervals
    when the clear span exceeds MAX_SPACING.
    """
    cx = (box.xmin + box.xmax) / 2.0
    cy = (box.ymin + box.ymax) / 2.0
    horizontal = box.width >= box.height
    length = box.width if horizontal else box.height
    if length < MAX_SPACING_PX * 1.15:
        return []

    # Number of interior divisions so spacing stays within 3–5 m
    n_segments = max(2, int(math.ceil(length / MAX_SPACING_PX)))
    step = length / n_segments
    # Prefer spacing not tighter than MIN
    if step < MIN_SPACING_PX:
        n_segments = max(2, int(math.floor(length / MIN_SPACING_PX)))
        step = length / max(n_segments, 1)

    points: list[tuple[float, float]] = []
    for i in range(1, n_segments):
        t = i * step
        if horizontal:
            points.append((box.xmin + t, cy))
        else:
            points.append((cx, box.ymin + t))
    return points


def _opening_boxes(openings: Sequence[Detection]) -> list[BoundingBox]:
    return [o.box for o in openings]


def _is_clear_of_openings(
    x: float, y: float, openings: Sequence[BoundingBox]
) -> bool:
    for op in openings:
        if _point_in_expanded_box(x, y, op, OPENING_CLEARANCE_PX):
            return False
    return True


def _clip_to_canvas(x: float, y: float, canvas: int = CANVAS_SIZE) -> tuple[float, float]:
    margin = COLUMN_HALF + 4
    return (
        float(min(max(x, margin), canvas - margin)),
        float(min(max(y, margin), canvas - margin)),
    )


def generate_structural_grid(
    walls: Sequence[dict[str, Any] | BoundingBox],
    openings: Sequence[Detection],
    canvas: int = CANVAS_SIZE,
) -> list[Detection]:
    """
    Prescriptive column layout from architectural geometry.

    Returns ``Detection`` columns (source=structural) ready for payload
    serialization. Callers should set ``is_ai_generated=True`` on the JSON.
    """
    opening_boxes = _opening_boxes(openings)
    raw_points: list[tuple[float, float]] = []

    wall_boxes: list[BoundingBox] = []
    for wall in walls:
        box = _wall_box(wall)
        if not box or box.area <= 0:
            continue
        wall_boxes.append(box)
        # Rule 1 — corners / junctions (all wall corners; clustering merges L/T/X)
        raw_points.extend(_wall_corners(box))
        # Rule 3 — intermediate posts on long spans
        raw_points.extend(_wall_axis_points(box))

    # Also treat pairwise wall AABB corner overlaps as reinforced junction votes
    for i, a in enumerate(wall_boxes):
        for b in wall_boxes[i + 1 :]:
            inter = a.intersection(
                BoundingBox(
                    b.xmin - CORNER_MERGE_PX,
                    b.ymin - CORNER_MERGE_PX,
                    b.xmax + CORNER_MERGE_PX,
                    b.ymax + CORNER_MERGE_PX,
                )
            )
            if inter is None:
                continue
            raw_points.append(
                ((inter.xmin + inter.xmax) / 2.0, (inter.ymin + inter.ymax) / 2.0)
            )

    if not raw_points and wall_boxes:
        # Degenerate fallback: place columns at building AABB corners
        xs = [b.xmin for b in wall_boxes] + [b.xmax for b in wall_boxes]
        ys = [b.ymin for b in wall_boxes] + [b.ymax for b in wall_boxes]
        raw_points = [
            (min(xs), min(ys)),
            (max(xs), min(ys)),
            (max(xs), max(ys)),
            (min(xs), max(ys)),
        ]

    clustered = _cluster_points(raw_points, CORNER_MERGE_PX)

    # Rule 2 — avoid openings
    cleared = [
        _clip_to_canvas(x, y, canvas)
        for x, y in clustered
        if _is_clear_of_openings(x, y, opening_boxes)
    ]

    # Enforce minimum spacing between accepted columns
    accepted: list[tuple[float, float]] = []
    for p in sorted(cleared, key=lambda q: (q[1], q[0])):
        if all(_dist(p, q) >= MIN_SPACING_PX * 0.85 for q in accepted):
            accepted.append(p)

    columns: list[Detection] = []
    for idx, (x, y) in enumerate(accepted, start=1):
        box = BoundingBox(
            x - COLUMN_HALF,
            y - COLUMN_HALF,
            x + COLUMN_HALF,
            y + COLUMN_HALF,
        ).clip(canvas, canvas)
        columns.append(
            Detection(
                id=f"AI-C{idx}",
                label=f"AI Column C{idx}",
                confidence=92.0,
                box=box,
                source="structural",
            )
        )

    logger.info(
        "GSL generated %d columns from %d wall segments / %d openings",
        len(columns),
        len(wall_boxes),
        len(openings),
    )
    return columns
