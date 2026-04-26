"""
Auth endpoints — login, register, token refresh, API key management.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.v1.deps import CurrentUser, DB
from app.schemas.schemas import (
    APIKeyCreate,
    APIKeyCreated,
    APIKeyOut,
    TokenResponse,
    UserCreate,
    UserOut,
)
from app.services.auth_service import (
    AuthService,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DB):
    svc = AuthService(db)
    if await svc.get_user_by_email(data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = await svc.create_user(data)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(db: DB, form: OAuth2PasswordRequestForm = Depends()):
    svc = AuthService(db)
    user = await svc.authenticate(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    from app.core.config import get_settings
    settings = get_settings()
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(db: DB, refresh_token: str):
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    svc = AuthService(db)
    user = await svc.get_user_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    from app.core.config import get_settings
    settings = get_settings()
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    return UserOut.model_validate(current_user)


@router.post("/api-keys", response_model=APIKeyCreated, status_code=201)
async def create_api_key(data: APIKeyCreate, db: DB, current_user: CurrentUser):
    """Create an API key. The full key is returned only once — store it securely."""
    svc = AuthService(db)
    api_key, full_key = await svc.create_api_key(
        user_id=current_user.id,
        name=data.name,
        expires_at=data.expires_at,
    )
    return APIKeyCreated(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        key=full_key,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        is_active=api_key.is_active,
    )


@router.get("/api-keys", response_model=list[APIKeyOut])
async def list_api_keys(db: DB, current_user: CurrentUser):
    from sqlalchemy import select
    from app.models.domain import APIKey
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active.is_(True),
        )
    )
    return [APIKeyOut.model_validate(k) for k in result.scalars().all()]


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(key_id: str, db: DB, current_user: CurrentUser):
    from sqlalchemy import select
    from app.models.domain import APIKey
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
