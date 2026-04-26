"""
Architecture module API.
ADRs, fitness functions, bounded contexts, and the AI context builder.
"""
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, DB, get_project_or_404
from app.models.domain import (
    ADR,
    ADRStatus,
    BoundedContext,
    FitnessFunction,
    FitnessFunctionResult,
    FitnessResult,
    FitnessSeverity,
    Project,
    Spec,
)
from app.schemas.schemas import (
    ADRCreate,
    ADROut,
    ADRUpdate,
    AIContextRequest,
    AIContextResponse,
    BoundedContextCreate,
    BoundedContextOut,
    FitnessFunctionCreate,
    FitnessFunctionOut,
    FitnessFunctionUpdate,
    FitnessRunRequest,
    FitnessRunResponse,
    FitnessRunResult,
    PaginatedResponse,
)
from app.services.fitness_service import FitnessService
from app.services.context_service import ContextBuilderService
from app.services.telemetry_service import TelemetryService

router = APIRouter(tags=["architecture"])


# ─── ADR endpoints ────────────────────────────────────────────────────────────

adr_router = APIRouter(prefix="/projects/{project_id}/adrs")


@adr_router.get("", response_model=PaginatedResponse)
async def list_adrs(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: ADRStatus | None = Query(default=None, alias="status"),
    tag: str | None = None,
):
    query = select(ADR).where(
        ADR.project_id == project_id,
        ADR.deleted_at.is_(None),
    )
    if status_filter:
        query = query.where(ADR.status == status_filter)
    if tag:
        query = query.where(ADR.tags.contains([tag]))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    adrs = (
        await db.execute(
            query.order_by(ADR.number.asc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()

    return PaginatedResponse(
        items=[ADROut.model_validate(a) for a in adrs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@adr_router.post("", response_model=ADROut, status_code=status.HTTP_201_CREATED)
async def create_adr(
    project_id: str,
    data: ADRCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Create a new ADR. Auto-assigns the next sequential number."""
    max_num = (
        await db.execute(
            select(func.max(ADR.number)).where(ADR.project_id == project_id)
        )
    ).scalar_one()
    next_number = (max_num or 0) + 1

    adr = ADR(
        project_id=project_id,
        number=next_number,
        title=data.title,
        context=data.context,
        decision=data.decision,
        consequences=data.consequences,
        alternatives_considered=data.alternatives_considered,
        tags=data.tags,
        author_id=current_user.id,
        status=ADRStatus.PROPOSED,
    )
    db.add(adr)
    await db.flush()

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="adr.created",
        payload={"adr_id": adr.id, "number": adr.number, "title": adr.title},
        actor_id=current_user.id,
    )
    return ADROut.model_validate(adr)


@adr_router.get("/{adr_id}", response_model=ADROut)
async def get_adr(
    project_id: str,
    adr_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    return ADROut.model_validate(await _get_adr_or_404(db, adr_id, project_id))


@adr_router.patch("/{adr_id}", response_model=ADROut)
async def update_adr(
    project_id: str,
    adr_id: str,
    data: ADRUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    adr = await _get_adr_or_404(db, adr_id, project_id)

    if data.title is not None:
        adr.title = data.title
    if data.status is not None:
        old_status = adr.status
        adr.status = data.status
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="adr.status_changed",
            payload={
                "adr_id": adr.id,
                "from": old_status.value,
                "to": data.status.value,
            },
            actor_id=current_user.id,
        )
    if data.context is not None:
        adr.context = data.context
    if data.decision is not None:
        adr.decision = data.decision
    if data.consequences is not None:
        adr.consequences = data.consequences
    if data.alternatives_considered is not None:
        adr.alternatives_considered = data.alternatives_considered
    if data.superseded_by_id is not None:
        # Verify the superseding ADR exists
        superseding = await _get_adr_or_404(db, data.superseded_by_id, project_id)
        adr.superseded_by_id = superseding.id
        adr.status = ADRStatus.SUPERSEDED
    if data.tags is not None:
        adr.tags = data.tags

    await db.flush()
    return ADROut.model_validate(adr)


@adr_router.delete("/{adr_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_adr(
    project_id: str,
    adr_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    adr = await _get_adr_or_404(db, adr_id, project_id)
    adr.soft_delete()


# ─── Fitness function endpoints ───────────────────────────────────────────────

fitness_router = APIRouter(prefix="/projects/{project_id}/fitness")


@fitness_router.get("", response_model=list[FitnessFunctionOut])
async def list_fitness_functions(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    active_only: bool = Query(default=True),
):
    query = select(FitnessFunction).where(
        FitnessFunction.project_id == project_id,
        FitnessFunction.deleted_at.is_(None),
    )
    if active_only:
        query = query.where(FitnessFunction.is_active.is_(True))
    result = await db.execute(query.order_by(FitnessFunction.created_at.asc()))
    return [FitnessFunctionOut.model_validate(f) for f in result.scalars().all()]


@fitness_router.post("", response_model=FitnessFunctionOut, status_code=status.HTTP_201_CREATED)
async def create_fitness_function(
    project_id: str,
    data: FitnessFunctionCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    ff = FitnessFunction(
        project_id=project_id,
        adr_id=data.adr_id,
        name=data.name,
        description=data.description,
        severity=data.severity,
        check_type=data.check_type,
        check_config=data.check_config.model_dump(exclude_none=True),
    )
    db.add(ff)
    await db.flush()

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="fitness_function.created",
        payload={"function_id": ff.id, "check_type": ff.check_type},
        actor_id=current_user.id,
    )
    return FitnessFunctionOut.model_validate(ff)


@fitness_router.patch("/{function_id}", response_model=FitnessFunctionOut)
async def update_fitness_function(
    project_id: str,
    function_id: str,
    data: FitnessFunctionUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    ff = await _get_ff_or_404(db, function_id, project_id)
    if data.name is not None:
        ff.name = data.name
    if data.description is not None:
        ff.description = data.description
    if data.severity is not None:
        ff.severity = data.severity
    if data.check_config is not None:
        ff.check_config = data.check_config.model_dump(exclude_none=True)
    if data.is_active is not None:
        ff.is_active = data.is_active
    await db.flush()
    return FitnessFunctionOut.model_validate(ff)


@fitness_router.delete("/{function_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fitness_function(
    project_id: str,
    function_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    ff = await _get_ff_or_404(db, function_id, project_id)
    ff.soft_delete()


@fitness_router.post("/run", response_model=FitnessRunResponse)
async def run_fitness_functions(
    project_id: str,
    request: FitnessRunRequest,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Execute one or more fitness functions and return results.
    Can be triggered manually here or by CI via API key.
    """
    fitness_svc = FitnessService(db)
    response = await fitness_svc.run(
        project_id=project_id,
        function_ids=request.function_ids,
        sprint_id=request.sprint_id,
        triggered_by=request.triggered_by,
    )
    # Record architecture drift events
    failed = [r for r in response.results if r.result == FitnessResult.FAIL]
    if failed:
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="architecture.drift_detected",
            payload={
                "sprint_id": request.sprint_id,
                "failed_functions": [f.function_id for f in failed],
                "count": len(failed),
            },
            actor_id=current_user.id,
            source=request.triggered_by,
        )
    return response


# ─── Bounded context endpoints ────────────────────────────────────────────────

context_router = APIRouter(prefix="/projects/{project_id}/contexts")


@context_router.get("", response_model=list[BoundedContextOut])
async def list_bounded_contexts(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    result = await db.execute(
        select(BoundedContext).where(
            BoundedContext.project_id == project_id,
            BoundedContext.deleted_at.is_(None),
        )
    )
    return [BoundedContextOut.model_validate(c) for c in result.scalars().all()]


@context_router.post("", response_model=BoundedContextOut, status_code=status.HTTP_201_CREATED)
async def create_bounded_context(
    project_id: str,
    data: BoundedContextCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    ctx = BoundedContext(
        project_id=project_id,
        name=data.name,
        description=data.description,
        includes=data.includes,
        excludes=data.excludes,
        interfaces=data.interfaces,
    )
    db.add(ctx)
    await db.flush()
    return BoundedContextOut.model_validate(ctx)


@context_router.get("/{context_id}", response_model=BoundedContextOut)
async def get_bounded_context(
    project_id: str,
    context_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    result = await db.execute(
        select(BoundedContext).where(
            BoundedContext.id == context_id,
            BoundedContext.project_id == project_id,
            BoundedContext.deleted_at.is_(None),
        )
    )
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Bounded context not found")
    return BoundedContextOut.model_validate(ctx)


@context_router.delete("/{context_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bounded_context(
    project_id: str,
    context_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    result = await db.execute(
        select(BoundedContext).where(
            BoundedContext.id == context_id,
            BoundedContext.project_id == project_id,
            BoundedContext.deleted_at.is_(None),
        )
    )
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Bounded context not found")
    ctx.soft_delete()


# ─── AI Context builder endpoint ──────────────────────────────────────────────

ai_context_router = APIRouter(prefix="/projects/{project_id}/ai-context")


@ai_context_router.post("", response_model=AIContextResponse)
async def build_ai_context(
    project_id: str,
    request: AIContextRequest,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Build an AI-ready context package from specs + ADRs + bounded context.
    This is the key integration point for CI pipelines and agent runners —
    returns a formatted string ready for prompt injection.
    """
    svc = ContextBuilderService(db)
    return await svc.build(
        project_id=project_id,
        request=request,
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_adr_or_404(db: AsyncSession, adr_id: str, project_id: str) -> ADR:
    result = await db.execute(
        select(ADR).where(
            ADR.id == adr_id,
            ADR.project_id == project_id,
            ADR.deleted_at.is_(None),
        )
    )
    adr = result.scalar_one_or_none()
    if not adr:
        raise HTTPException(status_code=404, detail="ADR not found")
    return adr


async def _get_ff_or_404(
    db: AsyncSession, function_id: str, project_id: str
) -> FitnessFunction:
    result = await db.execute(
        select(FitnessFunction).where(
            FitnessFunction.id == function_id,
            FitnessFunction.project_id == project_id,
            FitnessFunction.deleted_at.is_(None),
        )
    )
    ff = result.scalar_one_or_none()
    if not ff:
        raise HTTPException(status_code=404, detail="Fitness function not found")
    return ff


# Export all sub-routers for registration in main router
router.include_router(adr_router)
router.include_router(fitness_router)
router.include_router(context_router)
router.include_router(ai_context_router)
