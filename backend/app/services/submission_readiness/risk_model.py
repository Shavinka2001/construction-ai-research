"""
Load the trained risk pipeline and turn a rule summary into a risk band.

The artifact is a complete scikit-learn ``Pipeline``: preprocessing and
classifier in one object, fed a named ``DataFrame``. That is deliberate. The
prototype this replaces saved a bare classifier whose fitted vectorizer was
lost, so inference built a different one of matching width; the shapes agreed,
nothing raised, and the model returned confident labels at chance level. A
pipeline plus named columns makes that class of failure impossible — a wrong or
missing column raises instead of predicting.

The model is optional at runtime. If the artifact or scikit-learn is absent the
caller still gets every rule-based finding, with ``ml_available=False``. The
deterministic half of this component does not depend on the probabilistic half.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Optional

from app.core.config import BASE_DIR
from app.schemas.submission_readiness import MlPrediction, RuleSummary

logger = logging.getLogger(__name__)

MODEL_PATH = BASE_DIR / "app" / "ml" / "submission_risk_v1.joblib"
MODEL_VERSION = "submission_risk_v1"

#: Column order is irrelevant — the pipeline matches by name — but every one of
#: these must be present or scikit-learn raises, which is the intended
#: behaviour.
FEATURE_COLUMNS = (
    "application_type",
    "required_document_count",
    "submitted_document_count",
    "missing_document_count",
    "document_mismatch_count",
    "expired_document_count",
    "unverified_document_count",
    "conditional_clearance_required",
    "conditional_clearance_submitted",
)

_model: Optional[Any] = None
_load_error: Optional[str] = None
_lock = threading.Lock()


def _load() -> tuple[Optional[Any], Optional[str]]:
    """Load once; remember the failure so every request does not retry it."""
    global _model, _load_error
    if _model is not None or _load_error is not None:
        return _model, _load_error

    with _lock:
        if _model is not None or _load_error is not None:
            return _model, _load_error

        if not MODEL_PATH.is_file():
            _load_error = f"model artifact not found at {MODEL_PATH}"
            logger.warning("%s — rule findings will still be returned", _load_error)
            return None, _load_error

        try:
            import joblib  # noqa: PLC0415 — optional dependency, imported on demand
        except ImportError:
            _load_error = "joblib is not installed"
            logger.warning("%s — rule findings will still be returned", _load_error)
            return None, _load_error

        try:
            _model = joblib.load(MODEL_PATH)
        except Exception as exc:  # noqa: BLE001 — any load failure degrades the same way
            _load_error = f"could not load model: {exc}"
            logger.exception("failed to load %s", MODEL_PATH)
            return None, _load_error

        logger.info("loaded risk model %s from %s", MODEL_VERSION, MODEL_PATH)
        return _model, None


def is_available() -> bool:
    model, _ = _load()
    return model is not None


def predict(application_type: str, summary: RuleSummary) -> Optional[MlPrediction]:
    """
    Risk band for one assessed application, or ``None`` when unavailable.

    ``None`` is a normal outcome, not an error. The caller reports it as
    ``ml_available=False`` alongside the rule findings.
    """
    model, error = _load()
    if model is None:
        return None

    try:
        import pandas as pd  # noqa: PLC0415 — optional dependency, imported on demand
    except ImportError:
        logger.warning("pandas is not installed — skipping risk prediction")
        return None

    frame = pd.DataFrame(
        [
            {
                "application_type": application_type,
                "required_document_count": summary.required_document_count,
                "submitted_document_count": summary.submitted_document_count,
                "missing_document_count": summary.missing_document_count,
                "document_mismatch_count": summary.document_mismatch_count,
                "expired_document_count": summary.expired_document_count,
                "unverified_document_count": summary.unverified_document_count,
                "conditional_clearance_required": summary.conditional_clearance_required,
                "conditional_clearance_submitted": summary.conditional_clearance_submitted,
            }
        ],
        columns=list(FEATURE_COLUMNS),
    )

    try:
        label = str(model.predict(frame)[0])
        probabilities = {
            str(cls): round(float(p), 4)
            for cls, p in zip(model.classes_, model.predict_proba(frame)[0])
        }
    except Exception:  # noqa: BLE001 — a prediction failure must not fail the assessment
        logger.exception("risk prediction failed — returning rule findings only")
        return None

    if label not in ("low", "medium", "high"):
        logger.error("model returned unexpected label %r — discarding prediction", label)
        return None

    return MlPrediction(
        risk_level=label,  # type: ignore[arg-type]
        probabilities=probabilities,
        model_version=MODEL_VERSION,
    )


def predict_row(application_type: str, row: dict) -> Optional[str]:
    """
    Band for one hypothetical feature row, used by the recourse search.

    Separate from :func:`predict` because recourse asks "what if" about rows
    that do not correspond to any real assessment, and wants only the label.
    """
    model, _ = _load()
    if model is None:
        return None
    try:
        import pandas as pd  # noqa: PLC0415 — optional dependency, imported on demand
    except ImportError:
        return None

    frame = pd.DataFrame(
        [{"application_type": application_type, **row}], columns=list(FEATURE_COLUMNS)
    )
    try:
        return str(model.predict(frame)[0])
    except Exception:  # noqa: BLE001 — the caller treats a failure as "no recourse"
        logger.exception("recourse row prediction failed")
        return None


def unavailable_reason() -> Optional[str]:
    _, error = _load()
    return error
