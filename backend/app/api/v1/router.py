from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    architect,
    auth,
    compliance,
    health,
    land_validation,
    project,
    submission_readiness,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(architect.router)
api_router.include_router(project.router)
api_router.include_router(land_validation.router)
# Component 3. `compliance` is the v1 text-classification prototype, kept
# registered while the frontend is migrated; `submission_readiness` is the
# rule-engine replacement. See app/ml/model_card.md for why v1 is superseded.
api_router.include_router(compliance.router)
api_router.include_router(submission_readiness.router)
