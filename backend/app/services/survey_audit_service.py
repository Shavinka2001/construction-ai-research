"""
Module 2 — Sri Lankan Survey Mistake & Regulatory Checker.

A rule-based audit engine that checks an uploaded survey plan against Survey
Department / UDA expectations using OCR (Tesseract) + regex, and — when a
mandatory element is missing or illegible — emits a step-by-step advisory for
rectifying the plan with a licensed surveyor or the local authority (MC/UC/PS).
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top) -----------------------------------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import logging
import re
from functools import lru_cache
from typing import Any, Optional

import cv2
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# OCR
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _tesseract():
    """Return the pytesseract module if a usable Tesseract binary exists."""
    try:
        import pytesseract  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover
        logger.warning("pytesseract not importable (%s)", exc)
        return None

    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    try:
        version = pytesseract.get_tesseract_version()
        logger.info("Tesseract OCR available: v%s", version)
        return pytesseract
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "Tesseract binary not found (%s). Set TESSERACT_CMD in .env to enable OCR.",
            exc,
        )
        return None


def ocr_image(image_bgr: np.ndarray) -> tuple[Optional[str], Optional[str]]:
    """Return (uppercased OCR text, engine name) or (None, None) when unavailable."""
    pt = _tesseract()
    if pt is None:
        return None, None

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    try:
        text = pt.image_to_string(binary, config="--psm 11")
    except Exception as exc:  # pragma: no cover
        logger.warning("OCR failed (%s)", exc)
        return None, None
    return text.upper(), "tesseract"


# --------------------------------------------------------------------------- #
# Rule definitions
# --------------------------------------------------------------------------- #
_RULES: list[dict[str, Any]] = [
    {
        "key": "north_arrow",
        "label": "North arrow / orientation symbol",
        "patterns": [r"\bNORTH\b", r"\bMAGNETIC NORTH\b", r"\bTRUE NORTH\b", r"\bM\.?N\.?\b"],
        "advisory": [
            "Ask the licensed surveyor to add a clear north-point symbol (magnetic or true north) near a top corner.",
            "The orientation must match the bearings table so plot geometry can be geo-referenced.",
            "If digitising an old deed, request a fresh tracing / re-survey from a Registered Licensed Surveyor.",
        ],
    },
    {
        "key": "scale_notation",
        "label": "Scale notation (e.g. 1:500, 2 Chains to an Inch)",
        "patterns": [
            r"1\s*[:/]\s*\d{2,5}",
            r"\d+\s*CHAIN(S)?\s*TO\s*(AN?\s*)?INCH",
            r"SCALE",
        ],
        "advisory": [
            "Have the surveyor state the drawing scale explicitly (metric '1:500' / '1:1000' or 'X Chains to an Inch').",
            "A bar scale should also be drawn so the plan remains measurable after photocopying / resizing.",
            "Without a scale, submit the plan to the Survey Department for re-certification.",
        ],
    },
    {
        "key": "surveyor_credentials",
        "label": "Licensed Surveyor name, signature & registration seal",
        "patterns": [
            r"LICEN[CS]ED SURVEYOR",
            r"\bL\.?S\.?\b",
            r"REG(ISTRATION)?\.?\s*NO",
            r"SURVEYOR GENERAL",
            r"\bSURVEYED BY\b",
        ],
        "advisory": [
            "Only a Registered Licensed Surveyor may certify a survey plan — the plan must carry their printed name, signature and seal.",
            "Confirm the surveyor's registration number is current with the Survey Department / Institute of Surveyors Sri Lanka.",
            "An uncertified plan will be rejected by the Municipal/Urban/Pradeshiya Sabha at building-permit stage.",
        ],
    },
    {
        "key": "lot_number",
        "label": "Lot / Parcel identification number",
        "patterns": [r"\bLOT\s*(NO\.?|#|:)?\s*\d", r"\bPARCEL\b", r"\bPLAN NO\b", r"\bP\.?P\.?\s*\d"],
        "advisory": [
            "Each parcel on the plan must be labelled (e.g. 'Lot 1', 'Lot A') and cross-referenced to the schedule of boundaries.",
            "The plan number and date of survey must appear in the title block.",
            "Ask the surveyor to reconcile the lot numbering with the Land Registry folio.",
        ],
    },
    {
        "key": "boundary_dimensions",
        "label": "Perimeter dimensions & bearings on all segments",
        "patterns": [
            r"\d+\.\d+\s*(M|FT|LINKS?)",
            r"\d{1,3}\s*[°º]\s*\d{1,2}",
            r"\bBEARING(S)?\b",
            r"\bN\s*\d+\s*[°º].*[EW]\b",
        ],
        "advisory": [
            "Every perimeter line must show a length (metres / links / feet) and a bearing or included angle.",
            "Missing dimensions must be recovered by a boundary re-survey; do not scale them off the drawing.",
            "Request the surveyor's field notes / traverse computation sheet as supporting evidence.",
        ],
    },
    {
        "key": "road_access",
        "label": "Road access / street-line reservation",
        "patterns": [
            r"\bROAD\b",
            r"\bR\.?O\.?W\.?\b",
            r"RIGHT OF WAY",
            r"STREET LINE",
            r"\bACCESS\b",
            r"RESERVATION",
        ],
        "advisory": [
            "The plan must identify legal access — a public road frontage, a gazetted street line, or a defined right-of-way.",
            "If access is via a common road, the width and the servient/dominant tenements must be annotated.",
            "Confirm the street-line / building-line reservation with the local authority (MC / UC / PS) before designing.",
        ],
    },
]


def _match(text: str, patterns: list[str]) -> Optional[str]:
    for pat in patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None


# --------------------------------------------------------------------------- #
# Lightweight CV cue for the north arrow (works even without OCR)
# --------------------------------------------------------------------------- #
def _has_compass_glyph(image_bgr: np.ndarray) -> bool:
    """Heuristic: a small circular ink blob in an upper corner (compass rose)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    circles = cv2.HoughCircles(
        cv2.medianBlur(gray, 5),
        cv2.HOUGH_GRADIENT,
        dp=1.4,
        minDist=40,
        param1=120,
        param2=45,
        minRadius=8,
        maxRadius=60,
    )
    if circles is None:
        return False
    h, w = gray.shape[:2]
    for x, y, _r in np.round(circles[0]).astype(int):
        if (y < h * 0.30) and (x < w * 0.30 or x > w * 0.70):
            return True
    return False


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def audit_survey_plan(image_bgr: np.ndarray) -> dict[str, Any]:
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Empty or unreadable image")

    text, engine = ocr_image(image_bgr)
    ocr_available = text is not None
    compass = _has_compass_glyph(image_bgr)

    elements: list[dict[str, Any]] = []
    for rule in _RULES:
        evidence: Optional[str] = None
        status = "UNVERIFIED"

        if ocr_available:
            evidence = _match(text, rule["patterns"])
            status = "PRESENT" if evidence else "MISSING"

        if rule["key"] == "north_arrow" and compass:
            status = "PRESENT"
            evidence = evidence or "Compass-rose glyph detected in an upper corner (CV)."

        elements.append(
            {
                "key": rule["key"],
                "label": rule["label"],
                "status": status,
                "evidence": evidence,
                "advisory": [] if status == "PRESENT" else list(rule["advisory"]),
            }
        )

    present = sum(1 for e in elements if e["status"] == "PRESENT")
    missing = sum(1 for e in elements if e["status"] == "MISSING")
    unverified = sum(1 for e in elements if e["status"] == "UNVERIFIED")
    total = len(elements)
    compliance_score = round(100 * present / total) if total else 0

    if not ocr_available:
        summary = (
            f"OCR unavailable — {present}/{total} elements confirmed by computer vision only. "
            "Install Tesseract (set TESSERACT_CMD) for a full text audit."
        )
    elif missing == 0:
        summary = f"All {total} mandatory elements detected. Plan appears submission-ready."
    else:
        missing_labels = ", ".join(e["label"] for e in elements if e["status"] == "MISSING")
        summary = f"{missing} mandatory element(s) missing or illegible: {missing_labels}."

    return {
        "ocr_available": ocr_available,
        "ocr_engine": engine,
        "text_excerpt": (text[:600] if text else None),
        "elements": elements,
        "present_count": present,
        "missing_count": missing,
        "unverified_count": unverified,
        "compliance_score": compliance_score,
        "summary": summary,
    }
