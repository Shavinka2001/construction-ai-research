from fastapi import APIRouter

from app.api.v1.endpoints import admin, architect, auth, health, project

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(architect.router)
api_router.include_router(project.router)
