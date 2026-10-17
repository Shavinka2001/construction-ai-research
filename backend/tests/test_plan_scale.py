"""
Scale resolution tests.

The regression these guard is the one that invalidated every metric verdict in
the audit: the drawing's scale was two different hardcoded constants in two
different functions, so one wall measured 0.23 m by the thickness rule and
0.52 m by the room-area rule on the same sheet. ``test_wall_thickness_*``
below is the test that fails against the old behaviour.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.services import plan_scale as ps
from app.services.architectural_audit import detect_and_classify_walls


# ---------------------------------------------------------------------------
# Synthetic plan fixtures
# ---------------------------------------------------------------------------


def _blank(canvas: int = 1024) -> np.ndarray:
    """White sheet, BGR, like a registered canvas with nothing drawn on it."""
    return np.full((canvas, canvas, 3), 255, np.uint8)


def _plan_with_wall(thickness_px: int, canvas: int = 1024) -> np.ndarray:
    """
    A single long horizontal masonry wall of an exact ink thickness.

    Drawn well inside the sheet margin so the border-rejection filter does not
    discard it, and long enough to clear the minimum segment length.
    """
    img = _blank(canvas)
    y = canvas // 2
    cv2.line(img, (200, y), (820, y), (0, 0, 0), thickness_px)
    return img


def _plan_with_dimension_run(canvas: int = 1024) -> np.ndarray:
    """A thin 1 px dimension run plus a thick masonry stroke, for the filter."""
    img = _blank(canvas)
    cv2.line(img, (200, 300), (500, 300), (0, 0, 0), 1)  # dimension line
    cv2.line(img, (200, 600), (500, 600), (0, 0, 0), 12)  # masonry
    return img


# ---------------------------------------------------------------------------
# Dimension string parsing
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "token,expected",
    [
        ("3.50", 3.50),  # decimal metres
        ("3,50", 3.50),  # comma decimal separator
        ("3500", 3.50),  # bare millimetres
        ("900", 0.90),  # a door width in mm
        ("12'-6\"", 12 * 0.3048 + 6 * 0.0254),  # imperial feet-inches
        ("12'", 12 * 0.3048),  # whole feet
    ],
)
def test_parse_dimension_conventions(token: str, expected: float) -> None:
    parsed = ps.parse_dimension_to_meters(token)
    assert parsed is not None
    assert parsed == pytest.approx(expected, rel=1e-3)


@pytest.mark.parametrize(
    "token",
    [
        "",
        "abc",
        "0.1",  # below MIN_DIMENSION_M — not a room dimension
        "999999",  # 999.999 m — above MAX_DIMENSION_M
        "1",  # a single digit is a label, not a dimension
    ],
)
def test_parse_dimension_rejects_non_dimensions(token: str) -> None:
    assert ps.parse_dimension_to_meters(token) is None


# ---------------------------------------------------------------------------
# Resolution priority and provenance
# ---------------------------------------------------------------------------


def test_user_span_outranks_every_heuristic() -> None:
    bounds = {"width": 800.0, "height": 600.0}
    resolved = ps.resolve_scale(_blank(), bounds, 1024, plan_span_m=12.0)

    assert resolved.source == "USER_SPAN"
    assert resolved.confidence == 1.0
    assert resolved.is_measured is True
    # 12 m across the 800 px longer side of the footprint.
    assert resolved.meters_per_pixel == pytest.approx(12.0 / 800.0)
    assert resolved.pixels_per_meter == pytest.approx(800.0 / 12.0)


def test_blank_sheet_falls_back_to_assumed_and_flags_itself() -> None:
    """No dimensions, no stated span — the result must disclaim itself."""
    bounds = {"width": 800.0, "height": 600.0}
    resolved = ps.resolve_scale(_blank(), bounds, 1024)

    assert resolved.source == "ASSUMED_DEFAULT"
    assert resolved.confidence == 0.0
    assert resolved.is_measured is False
    assert resolved.to_payload()["metrics_trustworthy"] is False
    # This is the number the old code silently used for room areas while the
    # wall classifier used a hardcoded 100 px/m — a factor of 2.25 apart.
    assert resolved.pixels_per_meter == pytest.approx(800.0 / 18.0, rel=1e-3)


def test_implausible_stated_span_is_rejected_not_trusted() -> None:
    """A typo ('1800' instead of '18') must not become the scale."""
    bounds = {"width": 800.0, "height": 600.0}
    resolved = ps.resolve_scale(_blank(), bounds, 1024, plan_span_m=1800.0)

    assert resolved.source == "ASSUMED_DEFAULT"
    assert resolved.is_measured is False


def test_span_falls_back_to_canvas_when_no_footprint_detected() -> None:
    resolved = ps.resolve_scale_from_span(10.0, None, 1024)
    assert resolved is not None
    assert resolved.meters_per_pixel == pytest.approx(10.0 / 1024.0)


def test_payload_is_serialisable_and_complete() -> None:
    payload = ps.resolve_scale_from_span(12.0, {"width": 800.0}, 1024).to_payload()
    assert set(payload) == {
        "meters_per_pixel",
        "pixels_per_meter",
        "source",
        "confidence",
        "detail",
        "samples",
        "is_measured",
        "metrics_trustworthy",
    }


# ---------------------------------------------------------------------------
# Consensus robustness
# ---------------------------------------------------------------------------


def test_consensus_rejects_an_outlier_candidate() -> None:
    """One OCR misread must not drag the scale off the agreeing majority."""
    agreeing = [0.0200, 0.0203, 0.0198, 0.0201]
    centre, confidence = ps._consensus(agreeing + [0.2000])

    assert centre == pytest.approx(0.0200, rel=0.05)
    assert confidence > 0.0


def test_consensus_of_scattered_candidates_has_low_confidence() -> None:
    _, confidence = ps._consensus([0.005, 0.02, 0.09, 0.25])
    assert confidence < 0.6


def test_consensus_of_empty_set_is_zero() -> None:
    assert ps._consensus([]) == (0.0, 0.0)


# ---------------------------------------------------------------------------
# Dimension-line extraction
# ---------------------------------------------------------------------------


def test_dimension_line_filter_keeps_thin_runs_and_drops_masonry() -> None:
    segments = ps._dimension_line_segments(_plan_with_dimension_run())
    assert segments, "the 1 px dimension run should be found"

    # Every kept segment must sit on the thin line (y≈300), not the 12 px
    # masonry stroke (y≈600).
    for _x1, y1, _x2, y2 in segments:
        assert abs((y1 + y2) / 2.0 - 300.0) < 40.0


def test_ocr_absent_degrades_instead_of_failing(monkeypatch) -> None:
    """A missing Tesseract binary is a downgrade in source, not an error."""
    monkeypatch.setattr(ps, "_ocr_dimension_tokens", lambda _img: [])
    assert ps.resolve_scale_from_dimensions(_blank()) is None


# ---------------------------------------------------------------------------
# The regression: one ruler for the whole audit
# ---------------------------------------------------------------------------


def test_wall_thickness_honours_the_resolved_scale() -> None:
    """
    The classifier must measure thickness with the scale it is handed.

    Against the old code this fails: ``thickness_m`` was always
    ``thickness_px / 100``, so passing a different scale changed nothing.
    """
    plan = _plan_with_wall(thickness_px=20)

    coarse = detect_and_classify_walls(plan, [], meters_per_pixel=0.01)
    fine = detect_and_classify_walls(plan, [], meters_per_pixel=0.05)
    assert coarse and fine, "the synthetic wall should be detected"

    thickest_coarse = max(w["thickness_m"] for w in coarse)
    thickest_fine = max(w["thickness_m"] for w in fine)

    # 5x the metres-per-pixel must be 5x the reported thickness.
    assert thickest_fine == pytest.approx(5.0 * thickest_coarse, rel=0.02)


def test_wall_thickness_matches_room_area_ruler() -> None:
    """
    Thickness and area must be derived from the same metres-per-pixel.

    The reported thickness in metres divided by the scale must land back on the
    pixel thickness that was actually drawn — the property that did not hold
    while the two code paths used different constants.
    """
    drawn_px = 24
    mpp = 18.0 / 800.0  # what the room-area path used to compute on its own
    walls = detect_and_classify_walls(_plan_with_wall(drawn_px), [], meters_per_pixel=mpp)
    assert walls

    recovered_px = max(w["thickness_m"] for w in walls) / mpp
    assert recovered_px == pytest.approx(drawn_px, abs=6.0)


def test_load_bearing_classification_moves_with_the_scale() -> None:
    """
    A wall is load-bearing because of its real width, not its pixel count.

    One 20 px stroke is 0.10 m on a wide-site drawing and 0.40 m on a tight
    one; only the second clears the 0.23 m masonry threshold.
    """
    plan = _plan_with_wall(thickness_px=20)

    small_scale = detect_and_classify_walls(plan, [], meters_per_pixel=0.005)
    large_scale = detect_and_classify_walls(plan, [], meters_per_pixel=0.020)
    assert small_scale and large_scale

    assert all(w["wall_type"] == "PARTITION" for w in small_scale)
    assert any(w["wall_type"] == "LOAD_BEARING" for w in large_scale)
