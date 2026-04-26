"""
Main API router — registers all endpoint modules.
"""
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.intent import router as intent_router
from app.api.v1.endpoints.architecture import router as architecture_router
from app.api.v1.endpoints.loop import router as loop_router
from app.api.v1.endpoints.telemetry import router as telemetry_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(intent_router)
api_router.include_router(architecture_router)
api_router.include_router(loop_router)
api_router.include_router(telemetry_router)
