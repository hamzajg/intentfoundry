"""
FastAPI dependency injection.
All route-level dependencies live here — keeps endpoints thin.
"""
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.models.domain import User
from app.services.auth_service import AuthService, decode_token

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

DB = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DB,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> User:
    """
    Resolves the current user from either:
      - Bearer JWT token  (Authorization: Bearer <token>)
      - API key header    (X-API-Key: if_...)

    Raises 401 if neither is present or valid.
    """
    auth_service = AuthService(db)

    # Try API key first — preferred for CI/CD contexts
    if x_api_key:
        user = await auth_service.verify_api_key(x_api_key)
        if user and user.is_active:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )

    # Fall back to JWT bearer token
    if credentials:
        try:
            payload = decode_token(credentials.credentials)
            if payload.get("type") != "access":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type",
                )
            user_id: str = payload["sub"]
        except (JWTError, KeyError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = await auth_service.get_user_by_id(user_id)
        if user and user.is_active:
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_project_or_404(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
):
    """
    Resolves a project and verifies the current user owns it.
    Raises 404 if not found, 403 if not the owner.
    """
    from sqlalchemy import select
    from app.models.domain import Project

    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project
