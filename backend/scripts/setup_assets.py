"""
Readiness check for the Pre-Construction Feasibility Analyzer (R26_IT_154).

Run from the backend/ directory:

    python scripts/setup_assets.py

It creates weights/, tries to fetch the YOLOv8-seg fallback model, and reports
the status of the Google Earth Engine key and the Tesseract OCR binary. Nothing
here is required for the API to boot — missing assets only degrade specific
modules to their fallbacks.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

OK = "[ OK ]"
MISS = "[MISS]"
WARN = "[WARN]"


def check_weights() -> None:
    weights_dir = BACKEND_ROOT / "weights"
    weights_dir.mkdir(exist_ok=True)
    fine_tuned = weights_dir / "land_segmentation.pt"
    if fine_tuned.is_file():
        print(f"{OK} Fine-tuned weights present: {fine_tuned}")
        return
    print(f"{WARN} Fine-tuned weights not found: {fine_tuned}")
    try:
        from ultralytics import YOLO

        print("       Downloading yolov8n-seg.pt fallback ...")
        YOLO("yolov8n-seg.pt")
        print(f"{OK} yolov8n-seg.pt fallback ready")
    except Exception as exc:  # noqa: BLE001
        print(f"{MISS} Could not prepare a segmentation model ({exc}).")
        print("       Module 1 will use the pure-OpenCV contour extractor.")


def check_gee() -> None:
    from app.core.config import BASE_DIR, settings

    key = (BASE_DIR / settings.GEE_KEY_PATH).resolve()
    if not key.is_file():
        print(f"{WARN} GEE key not found: {key}")
        print("       Module 5 will use deterministic synthetic terrain.")
        return
    try:
        import json

        import ee

        client_email = json.loads(key.read_text(encoding="utf-8")).get("client_email")
        ee.Initialize(ee.ServiceAccountCredentials(client_email, str(key)), project=settings.GEE_PROJECT)
        ee.Image("USGS/SRTMGL1_003").getInfo()
        print(f"{OK} Google Earth Engine authenticated (project={settings.GEE_PROJECT})")
    except Exception as exc:  # noqa: BLE001
        print(f"{MISS} GEE key present but init failed ({exc}). Falling back to synthetic.")


def check_tesseract() -> None:
    from app.core.config import settings

    try:
        import pytesseract

        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        version = pytesseract.get_tesseract_version()
        print(f"{OK} Tesseract OCR available (v{version})")
    except Exception as exc:  # noqa: BLE001
        print(f"{WARN} Tesseract not usable ({exc}).")
        print("       Install it and set TESSERACT_CMD in .env for the full Module 2 text audit.")


if __name__ == "__main__":
    print("Pre-Construction Feasibility Analyzer — asset readiness\n")
    check_weights()
    check_gee()
    check_tesseract()
    print("\nDone. The API runs regardless of the warnings above.")
