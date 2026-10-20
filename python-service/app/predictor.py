"""
Run inference against the loaded compliance classifier.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.model_loader import get_model_and_vectorizer

KNOWN_LABELS = (
    "Compliant",
    "Pending Approval",
    "Minor Violation",
    "High Risk Violation",
)


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

    model, vectorizer = get_model_and_vectorizer()
    features = vectorizer.transform([text])
    label_raw = model.predict(features)[0]
    label = _normalize_label(label_raw)

    confidence: float | None = None
    probabilities: dict[str, float] | None = None

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(features)[0]
        classes = _class_labels(model)
        if classes and len(classes) == len(proba):
            probabilities = {
                cls: round(float(score), 4) for cls, score in zip(classes, proba)
            }
            idx = int(np.argmax(proba))
            confidence = round(float(proba[idx]), 4)
        else:
            confidence = round(float(np.max(proba)), 4)

    return {
        "label": label,
        "confidence": confidence,
        "probabilities": probabilities,
    }
