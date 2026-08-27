"""
AutoCAD DXF export — complete layered 2D floor plan.

Layers (ACI colors)
-------------------
  • WALLS    — White  — building wall footprints / boundary lines
  • COLUMNS  — Green  — resolved concrete columns (solid hatch)
  • DOORS    — Cyan   — door openings + swing arc indicator
  • WINDOWS  — Yellow — window openings + glass centerline

Coordinate systems
------------------
OpenCV / CV pixel space: top-left origin, Y grows **down**.
AutoCAD / ezdxf space:   bottom-left origin, Y grows **up**.

Every vertex is remapped with::

    y_cad = image_height - y_pixel

so WALLS, COLUMNS, DOORS, and WINDOWS share one aligned model space.
"""

from __future__ import annotations

import io
import logging
from typing import Any, Iterable, Sequence

import ezdxf
from ezdxf import colors
from ezdxf.enums import ACI

logger = logging.getLogger(__name__)

CANVAS_SIZE = 1024.0
DXF_FILENAME = "Resolved_Blueprint_Layout.dxf"

# AutoCAD Color Index
WALL_ACI = ACI.WHITE  # 7
COLUMN_ACI = ACI.GREEN  # 3
DOOR_ACI = ACI.CYAN  # 4
WINDOW_ACI = ACI.YELLOW  # 2


def _as_bbox(raw: Sequence[float] | dict[str, Any]) -> tuple[float, float, float, float]:
    """Normalize bbox to image-space ``(xmin, ymin, xmax, ymax)``."""
    if isinstance(raw, dict):
        return (
            float(raw["xmin"]),
            float(raw["ymin"]),
            float(raw["xmax"]),
            float(raw["ymax"]),
        )
    if len(raw) < 4:
        raise ValueError(f"Invalid bbox (need 4 numbers): {raw!r}")
    return float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3])


def image_point_to_cad(
    x_pixel: float,
    y_pixel: float,
    image_height: float,
) -> tuple[float, float]:
    """``y_cad = image_height - y_pixel`` — CV → CAD vertical flip."""
    return float(x_pixel), float(image_height) - float(y_pixel)


def image_bbox_to_cad(
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    image_height: float,
) -> tuple[float, float, float, float]:
    """
    Axis-aligned image bbox → CAD bbox (width/height preserved).

    ``ymin_cad = H - ymax_img``, ``ymax_cad = H - ymin_img``.
    """
    x0, x1 = float(xmin), float(xmax)
    y0 = float(image_height) - float(ymax)
    y1 = float(image_height) - float(ymin)
    return min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)


def _rect_points(
    xmin: float, ymin: float, xmax: float, ymax: float
) -> list[tuple[float, float]]:
    """Closed rectangle in CAD (Y-up) space."""
    return [
        (xmin, ymin),
        (xmax, ymin),
        (xmax, ymax),
        (xmin, ymax),
        (xmin, ymin),
    ]


def _iter_entities(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    items = payload.get(key) or []
    if not isinstance(items, list):
        return []
    return [i for i in items if isinstance(i, dict)]


def _cad_bbox_from_entity(
    entity: dict[str, Any],
    image_height: float,
) -> tuple[float, float, float, float] | None:
    try:
        ix0, iy0, ix1, iy1 = _as_bbox(entity.get("bbox") or entity.get("xyxy") or [])
        return image_bbox_to_cad(ix0, iy0, ix1, iy1, image_height)
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Skipping invalid entity %s: %s", entity.get("id"), exc)
        return None


def _add_label(
    msp: Any,
    text: str,
    cx: float,
    cy: float,
    layer: str,
    color: int,
    box_w: float,
) -> None:
    msp.add_text(
        text,
        height=max(6.0, min(18.0, box_w * 0.16)),
        dxfattribs={"layer": layer, "color": color},
    ).set_placement((cx, cy))


def _draw_wall(
    msp: Any,
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    label: str,
) -> None:
    """Wall footprint as closed polyline + long-axis centerline."""
    pts = _rect_points(xmin, ymin, xmax, ymax)
    msp.add_lwpolyline(
        pts,
        close=True,
        dxfattribs={"layer": "WALLS", "color": colors.BYLAYER},
    )
    # Centerline along the dominant axis (reads as a wall run in plan)
    cx = (xmin + xmax) / 2.0
    cy = (ymin + ymax) / 2.0
    if (xmax - xmin) >= (ymax - ymin):
        msp.add_line(
            (xmin, cy),
            (xmax, cy),
            dxfattribs={"layer": "WALLS", "color": colors.BYLAYER},
        )
    else:
        msp.add_line(
            (cx, ymin),
            (cx, ymax),
            dxfattribs={"layer": "WALLS", "color": colors.BYLAYER},
        )
    if label and label.upper() not in {"BOUNDARY", "OUTER BOUNDARY"}:
        _add_label(msp, label, cx, cy, "WALLS", int(WALL_ACI), xmax - xmin)


def _draw_column(
    msp: Any,
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    label: str,
) -> None:
    """Resolved column: outline + solid green hatch."""
    pts = _rect_points(xmin, ymin, xmax, ymax)
    msp.add_lwpolyline(
        pts,
        close=True,
        dxfattribs={"layer": "COLUMNS", "color": colors.BYLAYER},
    )
    hatch = msp.add_hatch(
        color=int(COLUMN_ACI),
        dxfattribs={"layer": "COLUMNS"},
    )
    hatch.paths.add_polyline_path(pts[:-1], is_closed=True)
    hatch.set_solid_fill()
    _add_label(
        msp,
        label,
        (xmin + xmax) / 2.0,
        (ymin + ymax) / 2.0,
        "COLUMNS",
        int(COLUMN_ACI),
        xmax - xmin,
    )


def _draw_door(
    msp: Any,
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    label: str,
) -> None:
    """
    Door opening box + 90° swing arc (architectural plan convention).

    Hinge is placed at the lower-left of the CAD bbox; the leaf length follows
    the longer side of the opening so the symbol stays readable at any aspect.
    """
    pts = _rect_points(xmin, ymin, xmax, ymax)
    msp.add_lwpolyline(
        pts,
        close=True,
        dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
    )

    w = xmax - xmin
    h = ymax - ymin
    hinge = (xmin, ymin)

    if w >= h:
        # Leaf along +X; swing toward +Y
        leaf = w
        msp.add_line(
            hinge,
            (xmin + leaf, ymin),
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )
        msp.add_arc(
            center=hinge,
            radius=leaf,
            start_angle=0.0,
            end_angle=90.0,
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )
        # Open leaf tip
        msp.add_line(
            hinge,
            (xmin, ymin + leaf),
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )
    else:
        # Leaf along +Y; swing toward +X
        leaf = h
        msp.add_line(
            hinge,
            (xmin, ymin + leaf),
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )
        msp.add_arc(
            center=hinge,
            radius=leaf,
            start_angle=0.0,
            end_angle=90.0,
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )
        msp.add_line(
            hinge,
            (xmin + leaf, ymin),
            dxfattribs={"layer": "DOORS", "color": colors.BYLAYER},
        )

    _add_label(
        msp,
        label,
        (xmin + xmax) / 2.0,
        (ymin + ymax) / 2.0,
        "DOORS",
        int(DOOR_ACI),
        max(w, h),
    )


def _draw_window(
    msp: Any,
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    label: str,
) -> None:
    """Window opening box + glass centerline (double-line plan cue)."""
    pts = _rect_points(xmin, ymin, xmax, ymax)
    msp.add_lwpolyline(
        pts,
        close=True,
        dxfattribs={"layer": "WINDOWS", "color": colors.BYLAYER},
    )
    cx = (xmin + xmax) / 2.0
    cy = (ymin + ymax) / 2.0
    # Primary glass line
    if (xmax - xmin) >= (ymax - ymin):
        msp.add_line(
            (xmin, cy),
            (xmax, cy),
            dxfattribs={"layer": "WINDOWS", "color": colors.BYLAYER},
        )
        # Parallel offset for classic double-line window symbol
        offset = max(2.0, (ymax - ymin) * 0.18)
        msp.add_line(
            (xmin, cy + offset),
            (xmax, cy + offset),
            dxfattribs={"layer": "WINDOWS", "color": colors.BYLAYER},
        )
    else:
        msp.add_line(
            (cx, ymin),
            (cx, ymax),
            dxfattribs={"layer": "WINDOWS", "color": colors.BYLAYER},
        )
        offset = max(2.0, (xmax - xmin) * 0.18)
        msp.add_line(
            (cx + offset, ymin),
            (cx + offset, ymax),
            dxfattribs={"layer": "WINDOWS", "color": colors.BYLAYER},
        )

    _add_label(msp, label, cx, cy, "WINDOWS", int(WINDOW_ACI), xmax - xmin)


def build_resolved_dxf_bytes(layout: dict[str, Any]) -> bytes:
    """
    Build a complete layered DXF floor plan from a resolved layout payload.

    Expected ``layout`` (stored on ``Report.clash_data_json``)::

        {
          "canvas_size": 1024,
          "walls":   [{"id": "W1", "bbox": [xmin,ymin,xmax,ymax], "label": "..."}],
          "columns": [{"id": "C2", "bbox": [...], "resolved": true}],
          "doors":   [{"id": "D1", "bbox": [...]}],
          "windows": [{"id": "W2", "bbox": [...]}]
        }

    All bboxes are OpenCV/image pixels; Y is inverted into CAD space before draw.
    """
    doc = ezdxf.new("R2010")
    doc.header["$INSUNITS"] = 4  # millimeters
    doc.layers.add("WALLS", color=int(WALL_ACI))
    doc.layers.add("COLUMNS", color=int(COLUMN_ACI))
    doc.layers.add("DOORS", color=int(DOOR_ACI))
    doc.layers.add("WINDOWS", color=int(WINDOW_ACI))

    msp = doc.modelspace()
    image_height = float(layout.get("canvas_size") or CANVAS_SIZE)
    image_width = image_height  # square 1024×1024 registration canvas

    # --- WALLS ----------------------------------------------------------------
    walls = _iter_entities(layout, "walls")
    if not walls:
        walls = [{"id": "BOUNDARY", "label": "Outer Boundary",
                  "bbox": [0.0, 0.0, image_width, image_height]}]

    for wall in walls:
        box = _cad_bbox_from_entity(wall, image_height)
        if not box:
            continue
        xmin, ymin, xmax, ymax = box
        label = str(wall.get("label") or wall.get("id") or "WALL")
        _draw_wall(msp, xmin, ymin, xmax, ymax, label)

    # --- COLUMNS (resolved / clash-free) --------------------------------------
    for col in _iter_entities(layout, "columns"):
        box = _cad_bbox_from_entity(col, image_height)
        if not box:
            continue
        xmin, ymin, xmax, ymax = box
        label = str(col.get("id") or col.get("label") or "COL")
        _draw_column(msp, xmin, ymin, xmax, ymax, label)

    # --- DOORS ----------------------------------------------------------------
    for door in _iter_entities(layout, "doors"):
        box = _cad_bbox_from_entity(door, image_height)
        if not box:
            continue
        xmin, ymin, xmax, ymax = box
        label = str(door.get("id") or door.get("label") or "DOOR")
        _draw_door(msp, xmin, ymin, xmax, ymax, label)

    # --- WINDOWS --------------------------------------------------------------
    for win in _iter_entities(layout, "windows"):
        box = _cad_bbox_from_entity(win, image_height)
        if not box:
            continue
        xmin, ymin, xmax, ymax = box
        label = str(win.get("id") or win.get("label") or "WIN")
        _draw_window(msp, xmin, ymin, xmax, ymax, label)

    buffer = io.StringIO()
    doc.write(buffer)
    return buffer.getvalue().encode("utf-8")
