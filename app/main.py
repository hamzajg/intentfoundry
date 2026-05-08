"""
IntentFoundry — FastAPI application factory.

Run locally:
    uvicorn app.main:app --reload --port 8000

Docker:
    docker compose up
"""
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.database import Base, check_db_connection, engine
from app.models import domain  # noqa: F401 — registers all models with Base

settings = get_settings()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    log.info("intentfoundry.starting", version=settings.app_version, env=settings.environment)

    # Create tables (dev/test only — use Alembic migrations in production)
    if not settings.is_production:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        log.info("intentfoundry.db.tables_created")

    # Verify DB connection
    if not await check_db_connection():
        log.error("intentfoundry.db.connection_failed")
        raise RuntimeError("Database connection failed on startup")

    log.info("intentfoundry.ready")
    yield

    # Cleanup
    await engine.dispose()
    log.info("intentfoundry.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="IntentFoundry API",
        description=(
            "Open source human-AI collaboration framework. "
            "Specification and architecture at the centre of every project."
        ),
        version=settings.app_version,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID + timing middleware
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())
        start = time.monotonic()
        request.state.request_id = request_id

        response = await call_next(request)

        duration_ms = int((time.monotonic() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        log.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id,
        )
        return response

    # Global exception handlers
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        log.error(
            "http.unhandled_exception",
            exc_type=type(exc).__name__,
            exc=str(exc),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred",
                "request_id": getattr(request.state, "request_id", None),
            },
        )

    # Routers
    app.include_router(api_router, prefix=settings.api_prefix)

    # Root API endpoint - serve frontend HTML
    @app.get("/", tags=["system"], include_in_schema=False)
    async def root():
        static_dir = Path(__file__).parent / "static"
        index_file = static_dir / "index.html"
        if index_file.exists():
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content=index_file.read_text())
        return {
            "name": "IntentFoundry API",
            "version": settings.app_version,
            "docs": "/docs",
            "community": "https://tanoshii-computing.com/community",
        }

    # Health check
    @app.get("/health", tags=["system"], include_in_schema=False)
    async def health():
        db_ok = await check_db_connection()
        return {
            "status": "healthy" if db_ok else "degraded",
            "version": settings.app_version,
            "environment": settings.environment,
            "database": "ok" if db_ok else "unavailable",
        }

    # Frontend static files (SPA) - must be registered AFTER API routes
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        from fastapi.responses import HTMLResponse

        # Mount JS/CSS assets at /assets so they are served directly
        assets_dir = static_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)))

        # Catch-all SPA fallback — serves index.html for any path that
        # doesn't match an API route or a mounted static asset.
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa_fallback(full_path: str):
            # Don't serve SPA for API routes
            if full_path.startswith("api/"):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
            index_file = static_dir / "index.html"
            if index_file.exists():
                return HTMLResponse(content=index_file.read_text())
            return JSONResponse(status_code=404, content={"detail": "Not found"})

        log.info("intentfoundry.static_mounted", path=str(static_dir))

    return app


app = create_app()