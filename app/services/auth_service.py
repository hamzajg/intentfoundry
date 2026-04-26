"""
Authentication service.
Handles JWT creation/validation, API key generation/verification,
and password hashing. All crypto operations live here — nothing else
should touch jose or passlib directly.
"""
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.domain import APIKey, User
from app.schemas.schemas import UserCreate

settings = get_settings()


# ─── Password ────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── JWT ─────────────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + expires_delta
    payload["iat"] = datetime.now(UTC)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


# ─── API Keys ─────────────────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str, str]:
    """
    Returns (full_key, prefix, hashed_key).
    Only the prefix and hash are stored — the full key is shown once on creation.
    """
    raw = secrets.token_urlsafe(32)
    full_key = f"{settings.api_key_prefix}{raw}"
    prefix = full_key[:12]  # "if_" + first 9 chars — safe to display
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ─── User service ─────────────────────────────────────────────────────────────

class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_user(self, data: UserCreate) -> User:
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def authenticate(self, email: str, password: str) -> User | None:
        user = await self.get_user_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    async def create_api_key(
        self, user_id: str, name: str, expires_at: datetime | None = None
    ) -> tuple[APIKey, str]:
        """Returns (APIKey model, full_key). Caller must show full_key once."""
        full_key, prefix, key_hash = generate_api_key()
        api_key = APIKey(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            prefix=prefix,
            expires_at=expires_at,
        )
        self.db.add(api_key)
        await self.db.flush()
        return api_key, full_key

    async def verify_api_key(self, raw_key: str) -> User | None:
        """Look up a user by raw API key. Updates last_used_at."""
        if not raw_key.startswith(settings.api_key_prefix):
            return None
        key_hash = hash_api_key(raw_key)
        result = await self.db.execute(
            select(APIKey)
            .where(
                APIKey.key_hash == key_hash,
                APIKey.is_active.is_(True),
            )
        )
        api_key = result.scalar_one_or_none()
        if not api_key:
            return None
        if api_key.expires_at and api_key.expires_at < datetime.now(UTC):
            return None
        # Update last_used_at without triggering full model load
        api_key.last_used_at = datetime.now(UTC)
        return await self.get_user_by_id(api_key.user_id)
