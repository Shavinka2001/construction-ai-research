from fastapi import APIRouter

from app.core.config import settings
from app.schemas.response import ApiResponse, success_response

router = APIRouter(tags=["Health"])


class HealthData(ApiResponse[dict]):
    """Typed health check response."""


@router.get(
    "/health",
    response_model=ApiResponse[dict],
    summary="Health check",
    description="Returns API health status and version metadata.",
)
async def health_check() -> dict:
    return success_response(
        data={
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
        message="Service is healthy",
    )
