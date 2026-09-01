"""Compliance ML prediction API."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.compliance_predictor import predict_compliance

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Compliance"])


class PredictRequest(BaseModel):
    inspection_text: str = Field(..., min_length=1, max_length=8000)


class PredictResponse(BaseModel):
    label: str
    confidence: float | None = None
    probabilities: dict[str, float] | None = None


@router.post("/predict-compliance", response_model=PredictResponse)
def predict(payload: PredictRequest):
    try:
        return PredictResponse(**predict_compliance(payload.inspection_text))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Compliance model is not available",
        ) from exc
    except Exception as exc:
        logger.exception("Compliance prediction failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Compliance prediction failed",
        ) from exc
