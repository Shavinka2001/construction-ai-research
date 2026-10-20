"""
Compliance ML inference — loads compliance_model.pkl and classifies inspection text.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from app.core.config import BASE_DIR

logger = logging.getLogger(__name__)

FEATURE_COUNT = 487
MODEL_PATH = BASE_DIR / "app" / "models" / "compliance_model.pkl"

KNOWN_LABELS = (
    "Compliant",
    "Pending Approval",
    "Minor Violation",
    "High Risk Violation",
)

_model: Any | None = None
_vectorizer: HashingVectorizer | None = None


def _load_classifier(path: Path) -> Any:
    try:
        return joblib.load(path)
    except Exception:
        logger.debug("joblib.load failed — falling back to pickle", exc_info=True)
        with path.open("rb") as handle:
            return pickle.load(handle)


def _ensure_loaded() -> tuple[Any, HashingVectorizer]:
    global _model, _vectorizer
    if _model is not None and _vectorizer is not None:
        return _model, _vectorizer

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Compliance model not found at {MODEL_PATH}")

    _model = _load_classifier(MODEL_PATH)
    _vectorizer = HashingVectorizer(
        n_features=FEATURE_COUNT,
        alternate_sign=False,
        norm="l2",
    )
    logger.info("Compliance model loaded from %s", MODEL_PATH)
    return _model, _vectorizer


def _normalize_label(raw: Any) -> str:
    text = str(raw).strip()
    for known in KNOWN_LABELS:
        if text.lower() == known.lower():
            return known
    return text


def _class_labels(model: Any) -> list[str] | None:
    if hasattr(model, "classes_"):
        return [_normalize_label(c) for c in model.classes_]
    return None


def predict_compliance(inspection_text: str) -> dict[str, Any]:
    text = inspection_text.strip()
    if not text:
        raise ValueError("inspection_text must not be empty")

    model, vectorizer = _ensure_loaded()
    features = vectorizer.transform([text])
    label = _normalize_label(model.predict(features)[0])

    confidence: float | None = None
    probabilities: dict[str, float] | None = None

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(features)[0]
        classes = _class_labels(model)
        if classes and len(classes) == len(proba):
            probabilities = {
                cls: round(float(score), 4) for cls, score in zip(classes, proba)
            }
            confidence = round(float(proba[int(np.argmax(proba))]), 4)
        else:
            confidence = round(float(np.max(proba)), 4)

    return {
        "label": label,
        "confidence": confidence,
        "probabilities": probabilities,
    }
