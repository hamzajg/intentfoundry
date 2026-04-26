"""
Shared SQLAlchemy base model.
All IntentFoundry domain entities use ULID primary keys (sortable, URL-safe)
and standard audit timestamps.
"""
from datetime import UTC, datetime

from ulid import ULID
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def new_ulid() -> str:
    return str(ULID())


def _now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    """Adds created_at / updated_at to any model using Python-side defaults.
    Python-side defaults avoid the MissingGreenlet error when reading
    back server_default values after flush in async sessions.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        onupdate=_now,
        nullable=False,
    )


class SoftDeleteMixin:
    """Adds deleted_at for soft-delete pattern — entities are never hard-deleted."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        self.deleted_at = datetime.now(UTC)


class BaseModel(Base, TimestampMixin):
    """Abstract base for all IntentFoundry domain models."""

    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(26),  # ULID is always 26 chars
        primary_key=True,
        default=new_ulid,
    )
