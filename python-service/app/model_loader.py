"""
Load the compliance classifier once at startup.

The trained RandomForest expects 487-dimensional text features (HashingVectorizer
output). The vectorizer is recreated at runtime with matching parameters.
"""

from __future__ import annotations

import logging
import pickle
from typing import Any

import joblib
from sklearn.feature_extraction.text import HashingVectorizer

from app.config import get_settings

logger = logging.getLogger(__name__)

_model: Any | None = None
_vectorizer: HashingVectorizer | None = None

# Must match the dimensionality the RandomForest was trained on.
FEATURE_COUNT = 487


def _load_classifier(path) -> Any:
    try:
        return joblib.load(path)
    except Exception:
        logger.debug("joblib.load failed — falling back to pickle", exc_info=True)
        with path.open("rb") as handle:
            return pickle.load(handle)


def load_model() -> tuple[Any, HashingVectorizer]:
    global _model, _vectorizer
    if _model is not None and _vectorizer is not None:
        return _model, _vectorizer

    path = get_settings().resolved_model_path()
    if not path.is_file():
        raise FileNotFoundError(f"Compliance model not found at {path}")

    _model = _load_classifier(path)
    _vectorizer = HashingVectorizer(
        n_features=FEATURE_COUNT,
        alternate_sign=False,
        norm="l2",
    )
    logger.info(
        "Compliance model loaded from %s (%s, %d features)",
        path,
        type(_model).__name__,
        FEATURE_COUNT,
    )
    return _model, _vectorizer


def get_model_and_vectorizer() -> tuple[Any, HashingVectorizer]:
    if _model is None or _vectorizer is None:
        raise RuntimeError("Compliance model has not been loaded yet")
    return _model, _vectorizer
