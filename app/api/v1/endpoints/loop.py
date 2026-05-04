"""
Loop module API — iteration lifecycle management.
Enforces the five-stage cycle with human decision checkpoints.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, DB, get_project_or_404
from app.models.domain import (
    Checkpoint,
    CheckpointStatus,
    Project,
    Iteration,
    IterationStage,
    IterationStatus,
)
from app.schemas.schemas import (
    CheckpointCreate,
    CheckpointOut,
    CheckpointResolve,
    IterationCreate,
    IterationOut,
    IterationReflectionUpdate,
    IterationUpdate,
    StageAdvanceRequest,
)
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/projects/{project_id}/iterations", tags=["loop"])

# Stage progression order
STAGE_ORDER = [
    IterationStage.DEFINE,
    IterationStage.GENERATE,
    IterationStage.VALIDATE,
    IterationStage.SHIP,
    IterationStage.REFLECT,
]


@router.get("", response_model=list[IterationOut])
async def list_iterations(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    iteration_status: IterationStatus | None = Query(default=None, alias="status"),
):
    query = select(Iteration).where(Iteration.project_id == project_id)
    if iteration_status:
        query = query.where(Iteration.status == iteration_status)
    result = await db.execute(query.order_by(Iteration.created_at.desc()))
    return [IterationOut.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=IterationOut, status_code=status.HTTP_201_CREATED)
async def create_iteration(
    project_id: str,
    data: IterationCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Create a new iteration. Starts in DEFINE stage.
    Automatically creates the first checkpoint (spec sign-off).
    """
    iteration = Iteration(
        project_id=project_id,
        name=data.name,
        goal=data.goal,
        spec_ids=data.spec_ids,
        active_adr_ids=data.active_adr_ids,
        bounded_context_id=data.bounded_context_id,
        current_stage=IterationStage.DEFINE,
        status=IterationStatus.ACTIVE,
    )
    db.add(iteration)
    await db.flush()

    # Auto-create the initial Define stage checkpoint
    checkpoint = Checkpoint(
        iteration_id=iteration.id,
        stage=IterationStage.DEFINE,
        title="Specification sign-off",
        description=(
            "Verify that all specs in scope are complete, unambiguous, "
            "and reviewed by the relevant stakeholders before AI generation begins."
        ),
        is_required=True,
    )
    db.add(checkpoint)

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="iteration.created",
        payload={
            "iteration_id": iteration.id,
            "spec_count": len(data.spec_ids),
            "adr_count": len(data.active_adr_ids),
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return IterationOut.model_validate(iteration)


@router.get("/{iteration_id}", response_model=IterationOut)
async def get_iteration(
    project_id: str,
    iteration_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    return IterationOut.model_validate(await _get_iteration_or_404(db, iteration_id, project_id))


@router.patch("/{iteration_id}", response_model=IterationOut)
async def update_iteration(
    project_id: str,
    iteration_id: str,
    data: IterationUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    iteration = await _get_iteration_or_404(db, iteration_id, project_id)
    if iteration.status != IterationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a completed or abandoned iteration",
        )
    if data.name is not None:
        iteration.name = data.name
    if data.goal is not None:
        iteration.goal = data.goal
    if data.spec_ids is not None:
        iteration.spec_ids = data.spec_ids
    if data.active_adr_ids is not None:
        iteration.active_adr_ids = data.active_adr_ids
    await db.flush()
    return IterationOut.model_validate(iteration)


@router.post("/{iteration_id}/advance", response_model=IterationOut)
async def advance_stage(
    project_id: str,
    iteration_id: str,
    request: StageAdvanceRequest,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Advance the iteration to the next stage.

    Enforces checkpoint completion before advancing — unless force=True,
    which requires a written reason and is logged as a governance exception.
    If the current stage is REFLECT, completes the iteration.
    """
    iteration = await _get_iteration_or_404(db, iteration_id, project_id)

    if iteration.status != IterationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Iteration is {iteration.status.value}, not active",
        )

    # Check for blocking pending checkpoints
    pending = await _get_pending_required_checkpoints(db, iteration_id, iteration.current_stage)

    if pending and not request.force:
        pending_titles = [c.title for c in pending]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Required checkpoints must be resolved before advancing",
                "pending_checkpoints": pending_titles,
            },
        )

    if pending and request.force:
        if not request.force_reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="force_reason is required when force=True",
            )
        # Auto-skip pending checkpoints with the force reason logged
        for cp in pending:
            cp.status = CheckpointStatus.SKIPPED
            cp.skip_reason = f"[FORCE ADVANCE] {request.force_reason}"
            cp.resolved_by_id = current_user.id
            cp.resolved_at = datetime.now(UTC)
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="iteration.checkpoints_force_skipped",
            payload={
                "iteration_id": iteration_id,
                "stage": iteration.current_stage.value,
                "reason": request.force_reason,
                "skipped_count": len(pending),
            },
            actor_id=current_user.id,
        )

    current_idx = STAGE_ORDER.index(iteration.current_stage)
    old_stage = iteration.current_stage

    if current_idx == len(STAGE_ORDER) - 1:
        # REFLECT → complete the iteration
        iteration.status = IterationStatus.COMPLETED
        iteration.completed_at = datetime.now(UTC)
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="iteration.completed",
            payload={"iteration_id": iteration_id},
            actor_id=current_user.id,
        )
    else:
        next_stage = STAGE_ORDER[current_idx + 1]
        iteration.current_stage = next_stage

        # Auto-create checkpoint for the new stage
        checkpoint_configs = {
            IterationStage.GENERATE: (
                "AI output review",
                "Review AI-generated output against the spec. "
                "Verify architectural constraints are respected.",
            ),
            IterationStage.VALIDATE: (
                "Fitness function gate",
                "All fitness functions must pass. "
                "Review test coverage against acceptance criteria.",
            ),
            IterationStage.SHIP: (
                "Acceptance criteria sign-off",
                "Confirm the output satisfies the acceptance criteria. "
                "Human sign-off that the right thing was built.",
            ),
            IterationStage.REFLECT: (
                "Reflection completion",
                "Document spec learnings and ADR updates "
                "from this iteration before closing.",
            ),
        }
        if next_stage in checkpoint_configs:
            title, description = checkpoint_configs[next_stage]
            checkpoint = Checkpoint(
                iteration_id=iteration_id,
                stage=next_stage,
                title=title,
                description=description,
                is_required=True,
            )
            db.add(checkpoint)

        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="iteration.stage_advanced",
            payload={
                "iteration_id": iteration_id,
                "from_stage": old_stage.value,
                "to_stage": next_stage.value,
                "notes": request.notes,
            },
            actor_id=current_user.id,
        )

    await db.flush()
    return IterationOut.model_validate(iteration)


@router.post("/{iteration_id}/abandon", response_model=IterationOut)
async def abandon_iteration(
    project_id: str,
    iteration_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    iteration = await _get_iteration_or_404(db, iteration_id, project_id)
    if iteration.status != IterationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Iteration is not active",
        )
    iteration.status = IterationStatus.ABANDONED
    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="iteration.abandoned",
        payload={"iteration_id": iteration_id, "stage": iteration.current_stage.value},
        actor_id=current_user.id,
    )
    return IterationOut.model_validate(iteration)


@router.put("/{iteration_id}/reflection", response_model=IterationOut)
async def update_reflection(
    project_id: str,
    iteration_id: str,
    data: IterationReflectionUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Stage 5 — update reflection notes and learnings."""
    iteration = await _get_iteration_or_404(db, iteration_id, project_id)
    if iteration.current_stage != IterationStage.REFLECT and iteration.status != IterationStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reflection is only available in the Reflect stage",
        )
    iteration.reflection_notes = data.reflection_notes
    iteration.spec_learnings = data.spec_learnings
    iteration.adr_learnings = data.adr_learnings

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="iteration.reflection_updated",
        payload={
            "iteration_id": iteration_id,
            "spec_learnings_count": len(data.spec_learnings),
            "adr_learnings_count": len(data.adr_learnings),
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return IterationOut.model_validate(iteration)


# ─── Checkpoint endpoints ─────────────────────────────────────────────────────

@router.get("/{iteration_id}/checkpoints", response_model=list[CheckpointOut])
async def list_checkpoints(
    project_id: str,
    iteration_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    await _get_iteration_or_404(db, iteration_id, project_id)
    result = await db.execute(
        select(Checkpoint)
        .where(Checkpoint.iteration_id == iteration_id)
        .order_by(Checkpoint.created_at.asc())
    )
    return [CheckpointOut.model_validate(c) for c in result.scalars().all()]


@router.post("/{iteration_id}/checkpoints", response_model=CheckpointOut, status_code=201)
async def create_checkpoint(
    project_id: str,
    iteration_id: str,
    data: CheckpointCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Add a custom checkpoint to any stage of an active iteration."""
    iteration = await _get_iteration_or_404(db, iteration_id, project_id)
    if iteration.status != IterationStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Iteration is not active")

    checkpoint = Checkpoint(
        iteration_id=iteration_id,
        stage=data.stage,
        title=data.title,
        description=data.description,
        is_required=data.is_required,
    )
    db.add(checkpoint)
    await db.flush()
    return CheckpointOut.model_validate(checkpoint)


@router.post("/{iteration_id}/checkpoints/{checkpoint_id}/resolve", response_model=CheckpointOut)
async def resolve_checkpoint(
    project_id: str,
    iteration_id: str,
    checkpoint_id: str,
    data: CheckpointResolve,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Approve, reject, or skip a checkpoint. Requires human sign-off."""
    await _get_iteration_or_404(db, iteration_id, project_id)

    result = await db.execute(
        select(Checkpoint).where(
            Checkpoint.id == checkpoint_id,
            Checkpoint.iteration_id == iteration_id,
        )
    )
    checkpoint = result.scalar_one_or_none()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    if checkpoint.status != CheckpointStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Checkpoint is already {checkpoint.status.value}",
        )
    if data.status == CheckpointStatus.SKIPPED and checkpoint.is_required:
        if not data.skip_reason:
            raise HTTPException(
                status_code=422,
                detail="skip_reason is required to skip a required checkpoint",
            )

    checkpoint.status = data.status
    checkpoint.resolution_notes = data.resolution_notes
    checkpoint.skip_reason = data.skip_reason
    checkpoint.resolved_by_id = current_user.id
    checkpoint.resolved_at = datetime.now(UTC)

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="checkpoint.resolved",
        payload={
            "iteration_id": iteration_id,
            "checkpoint_id": checkpoint_id,
            "status": data.status.value,
            "stage": checkpoint.stage.value,
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return CheckpointOut.model_validate(checkpoint)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_iteration_or_404(db: AsyncSession, iteration_id: str, project_id: str) -> Iteration:
    result = await db.execute(
        select(Iteration).where(Iteration.id == iteration_id, Iteration.project_id == project_id)
    )
    iteration = result.scalar_one_or_none()
    if not iteration:
        raise HTTPException(status_code=404, detail="Iteration not found")
    return iteration


async def _get_pending_required_checkpoints(
    db: AsyncSession, iteration_id: str, stage: IterationStage
) -> list[Checkpoint]:
    result = await db.execute(
        select(Checkpoint).where(
            Checkpoint.iteration_id == iteration_id,
            Checkpoint.stage == stage,
            Checkpoint.status == CheckpointStatus.PENDING,
            Checkpoint.is_required.is_(True),
        )
    )
    return list(result.scalars().all())
