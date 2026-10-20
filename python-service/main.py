"""
ConstructAI — Compliance ML micro-service.

POST /api/predict-compliance  — classify inspection text
GET  /health                  — readiness probe
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.model_loader import load_model
from app.predictor import predict_compliance
from app.schemas import PredictRequest, PredictResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    load_model()
    logger.info("Compliance service ready — model at %s", settings.resolved_model_path())
    yield


app = FastAPI(
    title="ConstructAI Compliance Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "compliance-ml"}


@app.post("/api/predict-compliance", response_model=PredictResponse)
def predict(payload: PredictRequest):
    try:
        result = predict_compliance(payload.inspection_text)
        return PredictResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Compliance prediction failed",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
