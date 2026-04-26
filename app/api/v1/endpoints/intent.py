"""
Intent module API — spec management with full version history.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, DB, get_project_or_404
from app.models.domain import Project, Spec, SpecFormat, SpecStatus, SpecVersion
from app.schemas.schemas import (
    PaginatedResponse,
    SpecCreate,
    SpecOut,
    SpecUpdate,
    SpecVersionOut,
)
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/projects/{project_id}/specs", tags=["intent"])


@router.get("", response_model=PaginatedResponse)
async def list_specs(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    format: SpecFormat | None = None,
    status: SpecStatus | None = None,
    tag: str | None = None,
    search: str | None = None,
):
    """List all specs for a project with optional filters."""
    query = select(Spec).where(
        Spec.project_id == project_id,
        Spec.deleted_at.is_(None),
    )
    if format:
        query = query.where(Spec.format == format)
    if status:
        query = query.where(Spec.status == status)
    if tag:
        # JSONB array contains — works in PostgreSQL; for SQLite uses JSON_EACH
        query = query.where(Spec.tags.contains([tag]))
    if search:
        query = query.where(Spec.title.ilike(f"%{search}%"))

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.order_by(Spec.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    specs = result.scalars().all()

    return PaginatedResponse(
        items=[SpecOut.model_validate(s) for s in specs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=SpecOut, status_code=status.HTTP_201_CREATED)
async def create_spec(
    project_id: str,
    data: SpecCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Create a new spec. Automatically creates version 1."""
    # Check slug uniqueness within project
    existing = await db.execute(
        select(Spec).where(
            Spec.project_id == project_id,
            Spec.slug == data.slug,
            Spec.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A spec with slug '{data.slug}' already exists in this project",
        )

    content_dict = data.content.model_dump(exclude_none=True)

    spec = Spec(
        project_id=project_id,
        title=data.title,
        slug=data.slug,
        format=data.format,
        content=content_dict,
        linked_adr_ids=data.linked_adr_ids,
        bounded_context_id=data.bounded_context_id,
        tags=data.tags,
        author_id=current_user.id,
        current_version=1,
    )
    db.add(spec)
    await db.flush()  # Get the ID

    # Create immutable version 1
    version = SpecVersion(
        spec_id=spec.id,
        version_number=1,
        content=content_dict,
        change_summary=data.change_summary or "Initial version",
        author_id=current_user.id,
    )
    db.add(version)

    # Emit telemetry event
    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="spec.created",
        payload={"spec_id": spec.id, "format": data.format.value},
        actor_id=current_user.id,
    )

    await db.flush()
    return SpecOut.model_validate(spec)


@router.get("/{spec_id}", response_model=SpecOut)
async def get_spec(
    project_id: str,
    spec_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    spec = await _get_spec_or_404(db, spec_id, project_id)
    return SpecOut.model_validate(spec)


@router.patch("/{spec_id}", response_model=SpecOut)
async def update_spec(
    project_id: str,
    spec_id: str,
    data: SpecUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Update a spec. If content changes, creates a new version automatically.
    """
    spec = await _get_spec_or_404(db, spec_id, project_id)
    content_changed = False

    if data.title is not None:
        spec.title = data.title
    if data.status is not None:
        spec.status = data.status
    if data.linked_adr_ids is not None:
        spec.linked_adr_ids = data.linked_adr_ids
    if data.bounded_context_id is not None:
        spec.bounded_context_id = data.bounded_context_id
    if data.tags is not None:
        spec.tags = data.tags
    if data.format is not None:
        spec.format = data.format

    if data.content is not None:
        new_content = data.content.model_dump(exclude_none=True)
        if new_content != spec.content:
            content_changed = True
            spec.content = new_content
            spec.current_version += 1
            version = SpecVersion(
                spec_id=spec.id,
                version_number=spec.current_version,
                content=new_content,
                change_summary=data.change_summary or f"Version {spec.current_version}",
                author_id=current_user.id,
            )
            db.add(version)

    if content_changed:
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="spec.updated",
            payload={
                "spec_id": spec.id,
                "new_version": spec.current_version,
                "content_changed": True,
            },
            actor_id=current_user.id,
        )

    await db.flush()
    return SpecOut.model_validate(spec)


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spec(
    project_id: str,
    spec_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    spec = await _get_spec_or_404(db, spec_id, project_id)
    spec.soft_delete()
    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="spec.deleted",
        payload={"spec_id": spec.id},
        actor_id=current_user.id,
    )


@router.get("/{spec_id}/versions", response_model=list[SpecVersionOut])
async def list_spec_versions(
    project_id: str,
    spec_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Full version history for a spec — newest first."""
    await _get_spec_or_404(db, spec_id, project_id)
    result = await db.execute(
        select(SpecVersion)
        .where(SpecVersion.spec_id == spec_id)
        .order_by(SpecVersion.version_number.desc())
    )
    return [SpecVersionOut.model_validate(v) for v in result.scalars().all()]


@router.get("/{spec_id}/versions/{version_number}", response_model=SpecVersionOut)
async def get_spec_version(
    project_id: str,
    spec_id: str,
    version_number: int,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Retrieve a specific historical version of a spec."""
    await _get_spec_or_404(db, spec_id, project_id)
    result = await db.execute(
        select(SpecVersion).where(
            SpecVersion.spec_id == spec_id,
            SpecVersion.version_number == version_number,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_number} not found",
        )
    return SpecVersionOut.model_validate(version)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_spec_or_404(db: AsyncSession, spec_id: str, project_id: str) -> Spec:
    result = await db.execute(
        select(Spec).where(
            Spec.id == spec_id,
            Spec.project_id == project_id,
            Spec.deleted_at.is_(None),
        )
    )
    spec = result.scalar_one_or_none()
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")
    return spec
