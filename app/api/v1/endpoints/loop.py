"""
Loop module API — sprint lifecycle management.
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
    Sprint,
    SprintStage,
    SprintStatus,
)
from app.schemas.schemas import (
    CheckpointCreate,
    CheckpointOut,
    CheckpointResolve,
    SprintCreate,
    SprintOut,
    SprintReflectionUpdate,
    SprintUpdate,
    StageAdvanceRequest,
)
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/projects/{project_id}/sprints", tags=["loop"])

# Stage progression order
STAGE_ORDER = [
    SprintStage.DEFINE,
    SprintStage.GENERATE,
    SprintStage.VALIDATE,
    SprintStage.SHIP,
    SprintStage.REFLECT,
]


@router.get("", response_model=list[SprintOut])
async def list_sprints(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    sprint_status: SprintStatus | None = Query(default=None, alias="status"),
):
    query = select(Sprint).where(Sprint.project_id == project_id)
    if sprint_status:
        query = query.where(Sprint.status == sprint_status)
    result = await db.execute(query.order_by(Sprint.created_at.desc()))
    return [SprintOut.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
async def create_sprint(
    project_id: str,
    data: SprintCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Create a new sprint. Starts in DEFINE stage.
    Automatically creates the first checkpoint (spec sign-off).
    """
    sprint = Sprint(
        project_id=project_id,
        name=data.name,
        goal=data.goal,
        spec_ids=data.spec_ids,
        active_adr_ids=data.active_adr_ids,
        bounded_context_id=data.bounded_context_id,
        current_stage=SprintStage.DEFINE,
        status=SprintStatus.ACTIVE,
    )
    db.add(sprint)
    await db.flush()

    # Auto-create the initial Define stage checkpoint
    checkpoint = Checkpoint(
        sprint_id=sprint.id,
        stage=SprintStage.DEFINE,
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
        event_type="sprint.created",
        payload={
            "sprint_id": sprint.id,
            "spec_count": len(data.spec_ids),
            "adr_count": len(data.active_adr_ids),
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return SprintOut.model_validate(sprint)


@router.get("/{sprint_id}", response_model=SprintOut)
async def get_sprint(
    project_id: str,
    sprint_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    return SprintOut.model_validate(await _get_sprint_or_404(db, sprint_id, project_id))


@router.patch("/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    project_id: str,
    sprint_id: str,
    data: SprintUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    sprint = await _get_sprint_or_404(db, sprint_id, project_id)
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a completed or abandoned sprint",
        )
    if data.name is not None:
        sprint.name = data.name
    if data.goal is not None:
        sprint.goal = data.goal
    if data.spec_ids is not None:
        sprint.spec_ids = data.spec_ids
    if data.active_adr_ids is not None:
        sprint.active_adr_ids = data.active_adr_ids
    await db.flush()
    return SprintOut.model_validate(sprint)


@router.post("/{sprint_id}/advance", response_model=SprintOut)
async def advance_stage(
    project_id: str,
    sprint_id: str,
    request: StageAdvanceRequest,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Advance the sprint to the next stage.

    Enforces checkpoint completion before advancing — unless force=True,
    which requires a written reason and is logged as a governance exception.
    If the current stage is REFLECT, completes the sprint.
    """
    sprint = await _get_sprint_or_404(db, sprint_id, project_id)

    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sprint is {sprint.status.value}, not active",
        )

    # Check for blocking pending checkpoints
    pending = await _get_pending_required_checkpoints(db, sprint_id, sprint.current_stage)

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
            event_type="sprint.checkpoints_force_skipped",
            payload={
                "sprint_id": sprint_id,
                "stage": sprint.current_stage.value,
                "reason": request.force_reason,
                "skipped_count": len(pending),
            },
            actor_id=current_user.id,
        )

    current_idx = STAGE_ORDER.index(sprint.current_stage)
    old_stage = sprint.current_stage

    if current_idx == len(STAGE_ORDER) - 1:
        # REFLECT → complete the sprint
        sprint.status = SprintStatus.COMPLETED
        sprint.completed_at = datetime.now(UTC)
        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="sprint.completed",
            payload={"sprint_id": sprint_id},
            actor_id=current_user.id,
        )
    else:
        next_stage = STAGE_ORDER[current_idx + 1]
        sprint.current_stage = next_stage

        # Auto-create checkpoint for the new stage
        checkpoint_configs = {
            SprintStage.GENERATE: (
                "AI output review",
                "Review AI-generated output against the spec. "
                "Verify architectural constraints are respected.",
            ),
            SprintStage.VALIDATE: (
                "Fitness function gate",
                "All fitness functions must pass. "
                "Review test coverage against acceptance criteria.",
            ),
            SprintStage.SHIP: (
                "Acceptance criteria sign-off",
                "Confirm the output satisfies the acceptance criteria. "
                "Human sign-off that the right thing was built.",
            ),
            SprintStage.REFLECT: (
                "Reflection completion",
                "Document spec learnings and ADR updates "
                "from this sprint before closing.",
            ),
        }
        if next_stage in checkpoint_configs:
            title, description = checkpoint_configs[next_stage]
            checkpoint = Checkpoint(
                sprint_id=sprint_id,
                stage=next_stage,
                title=title,
                description=description,
                is_required=True,
            )
            db.add(checkpoint)

        await TelemetryService(db).emit(
            project_id=project_id,
            event_type="sprint.stage_advanced",
            payload={
                "sprint_id": sprint_id,
                "from_stage": old_stage.value,
                "to_stage": next_stage.value,
                "notes": request.notes,
            },
            actor_id=current_user.id,
        )

    await db.flush()
    return SprintOut.model_validate(sprint)


@router.post("/{sprint_id}/abandon", response_model=SprintOut)
async def abandon_sprint(
    project_id: str,
    sprint_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    sprint = await _get_sprint_or_404(db, sprint_id, project_id)
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sprint is not active",
        )
    sprint.status = SprintStatus.ABANDONED
    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="sprint.abandoned",
        payload={"sprint_id": sprint_id, "stage": sprint.current_stage.value},
        actor_id=current_user.id,
    )
    return SprintOut.model_validate(sprint)


@router.put("/{sprint_id}/reflection", response_model=SprintOut)
async def update_reflection(
    project_id: str,
    sprint_id: str,
    data: SprintReflectionUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Stage 5 — update reflection notes and learnings."""
    sprint = await _get_sprint_or_404(db, sprint_id, project_id)
    if sprint.current_stage != SprintStage.REFLECT and sprint.status != SprintStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reflection is only available in the Reflect stage",
        )
    sprint.reflection_notes = data.reflection_notes
    sprint.spec_learnings = data.spec_learnings
    sprint.adr_learnings = data.adr_learnings

    await TelemetryService(db).emit(
        project_id=project_id,
        event_type="sprint.reflection_updated",
        payload={
            "sprint_id": sprint_id,
            "spec_learnings_count": len(data.spec_learnings),
            "adr_learnings_count": len(data.adr_learnings),
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return SprintOut.model_validate(sprint)


# ─── Checkpoint endpoints ─────────────────────────────────────────────────────

@router.get("/{sprint_id}/checkpoints", response_model=list[CheckpointOut])
async def list_checkpoints(
    project_id: str,
    sprint_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    await _get_sprint_or_404(db, sprint_id, project_id)
    result = await db.execute(
        select(Checkpoint)
        .where(Checkpoint.sprint_id == sprint_id)
        .order_by(Checkpoint.created_at.asc())
    )
    return [CheckpointOut.model_validate(c) for c in result.scalars().all()]


@router.post("/{sprint_id}/checkpoints", response_model=CheckpointOut, status_code=201)
async def create_checkpoint(
    project_id: str,
    sprint_id: str,
    data: CheckpointCreate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Add a custom checkpoint to any stage of an active sprint."""
    sprint = await _get_sprint_or_404(db, sprint_id, project_id)
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Sprint is not active")

    checkpoint = Checkpoint(
        sprint_id=sprint_id,
        stage=data.stage,
        title=data.title,
        description=data.description,
        is_required=data.is_required,
    )
    db.add(checkpoint)
    await db.flush()
    return CheckpointOut.model_validate(checkpoint)


@router.post("/{sprint_id}/checkpoints/{checkpoint_id}/resolve", response_model=CheckpointOut)
async def resolve_checkpoint(
    project_id: str,
    sprint_id: str,
    checkpoint_id: str,
    data: CheckpointResolve,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Approve, reject, or skip a checkpoint. Requires human sign-off."""
    await _get_sprint_or_404(db, sprint_id, project_id)

    result = await db.execute(
        select(Checkpoint).where(
            Checkpoint.id == checkpoint_id,
            Checkpoint.sprint_id == sprint_id,
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
            "sprint_id": sprint_id,
            "checkpoint_id": checkpoint_id,
            "status": data.status.value,
            "stage": checkpoint.stage.value,
        },
        actor_id=current_user.id,
    )
    await db.flush()
    return CheckpointOut.model_validate(checkpoint)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_sprint_or_404(db: AsyncSession, sprint_id: str, project_id: str) -> Sprint:
    result = await db.execute(
        select(Sprint).where(Sprint.id == sprint_id, Sprint.project_id == project_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


async def _get_pending_required_checkpoints(
    db: AsyncSession, sprint_id: str, stage: SprintStage
) -> list[Checkpoint]:
    result = await db.execute(
        select(Checkpoint).where(
            Checkpoint.sprint_id == sprint_id,
            Checkpoint.stage == stage,
            Checkpoint.status == CheckpointStatus.PENDING,
            Checkpoint.is_required.is_(True),
        )
    )
    return list(result.scalars().all())
