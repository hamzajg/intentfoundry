"""
Pytest fixtures shared across the test suite.
Uses an in-memory SQLite database — no external services required.
"""
import asyncio
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base, get_db
from app.models import domain  # noqa: F401 — registers all models

# ─── Test database ────────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_tables():
    """Create all tables once per test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """
    Provide a test database session that rolls back after each test.
    This keeps tests isolated without truncating tables.
    """
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ─── Application fixture ──────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def app(db: AsyncSession) -> FastAPI:
    """FastAPI app with the test DB injected."""
    from app.main import create_app

    application = create_app()

    async def override_get_db():
        yield db

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Unauthenticated async HTTP test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


# ─── Auth helpers ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def test_user(db: AsyncSession) -> dict[str, Any]:
    """Create a test user and return their credentials."""
    from app.services.auth_service import AuthService
    from app.schemas.schemas import UserCreate

    svc = AuthService(db)
    user = await svc.create_user(
        UserCreate(email="test@intentfoundry.dev", password="testpassword123")
    )
    await db.commit()
    return {"id": user.id, "email": user.email, "password": "testpassword123"}


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: dict) -> dict[str, str]:
    """Return Authorization headers for the test user."""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_project(
    client: AsyncClient,
    auth_headers: dict,
) -> dict[str, Any]:
    """Create a test project and return its data."""
    response = await client.post(
        "/api/v1/projects",
        json={
            "name": "Test Project",
            "slug": "test-project",
            "description": "Integration test project",
            "domain": "software",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()
