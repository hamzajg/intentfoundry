"""
Telemetry module API.
Loop health metrics, event history, and real-time SSE streaming.
"""
import asyncio
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select

from app.api.v1.deps import CurrentUser, DB, get_project_or_404
from app.core.config import get_settings
from app.models.domain import LoopMetric, Project, Sprint, SprintStatus, TelemetryEvent
from app.schemas.schemas import LoopMetricOut, ProjectHealthOut, TelemetryEventOut
from app.services.telemetry_service import TelemetryService

settings = get_settings()
router = APIRouter(prefix="/projects/{project_id}/telemetry", tags=["telemetry"])


@router.get("/events", response_model=list[TelemetryEventOut])
async def list_events(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    event_type: str | None = None,
    sprint_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Paginated event log — newest first."""
    query = select(TelemetryEvent).where(TelemetryEvent.project_id == project_id)
    if event_type:
        query = query.where(TelemetryEvent.event_type == event_type)
    if sprint_id:
        query = query.where(TelemetryEvent.sprint_id == sprint_id)

    result = await db.execute(
        query.order_by(TelemetryEvent.created_at.desc()).offset(offset).limit(limit)
    )
    return [TelemetryEventOut.model_validate(e) for e in result.scalars().all()]


@router.get("/metrics", response_model=list[LoopMetricOut])
async def list_loop_metrics(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Loop health metrics per sprint — most recent first."""
    result = await db.execute(
        select(LoopMetric)
        .where(LoopMetric.project_id == project_id)
        .order_by(LoopMetric.created_at.desc())
        .limit(limit)
    )
    return [LoopMetricOut.model_validate(m) for m in result.scalars().all()]


@router.get("/metrics/{sprint_id}", response_model=LoopMetricOut)
async def get_sprint_metrics(
    project_id: str,
    sprint_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Loop health metrics for a specific sprint."""
    result = await db.execute(
        select(LoopMetric).where(
            LoopMetric.project_id == project_id,
            LoopMetric.sprint_id == sprint_id,
        )
    )
    metric = result.scalar_one_or_none()
    if not metric:
        # Compute on demand if not yet cached
        svc = TelemetryService(db)
        metric = await svc.compute_loop_metrics(project_id=project_id, sprint_id=sprint_id)
    return LoopMetricOut.model_validate(metric)


@router.post("/metrics/{sprint_id}/recompute", response_model=LoopMetricOut)
async def recompute_sprint_metrics(
    project_id: str,
    sprint_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """Force recomputation of loop health metrics for a sprint."""
    svc = TelemetryService(db)
    metric = await svc.compute_loop_metrics(
        project_id=project_id, sprint_id=sprint_id, force=True
    )
    return LoopMetricOut.model_validate(metric)


@router.get("/health", response_model=ProjectHealthOut)
async def get_project_health(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Aggregated loop health summary across all sprints.
    The four key health indicators from the IntentFoundry model:
      1. Spec rework count
      2. Architecture drift count
      3. Review cycle length
      4. Reflect stage completion rate
    """
    svc = TelemetryService(db)
    return await svc.compute_project_health(project_id=project_id)


@router.get("/stream")
async def stream_telemetry(
    project_id: str,
    request: Request,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    """
    Server-Sent Events stream for real-time loop telemetry.

    Clients subscribe to this endpoint and receive events as they are emitted:
      - sprint.stage_advanced
      - checkpoint.resolved
      - fitness.failed / fitness.passed
      - architecture.drift_detected
      - spec.rework_detected

    Connect:
        GET /api/v1/projects/{id}/telemetry/stream
        Accept: text/event-stream

    Each event is a JSON payload:
        data: {"event_type": "...", "payload": {...}, "timestamp": "..."}
    """
    async def event_generator():
        # In production, this reads from Redis pub/sub
        # In dev mode (Redis disabled), polls the DB for new events
        last_event_id = None
        keepalive_counter = 0

        yield _sse_comment("IntentFoundry telemetry stream connected")
        yield _sse_event("connected", {"project_id": project_id})

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            if settings.redis_enabled:
                # Production: Redis pub/sub (non-blocking)
                # This would subscribe to if:telemetry:{project_id}
                # and yield events as they arrive.
                # Full Redis implementation in Phase 2.
                await asyncio.sleep(0.1)
            else:
                # Dev mode: poll DB for new events since last_event_id
                from app.db.database import AsyncSessionLocal
                async with AsyncSessionLocal() as db:
                    query = select(TelemetryEvent).where(
                        TelemetryEvent.project_id == project_id
                    )
                    if last_event_id:
                        # Get events newer than the last one we sent
                        last_result = await db.execute(
                            select(TelemetryEvent.created_at).where(
                                TelemetryEvent.id == last_event_id
                            )
                        )
                        last_ts = last_result.scalar_one_or_none()
                        if last_ts:
                            query = query.where(TelemetryEvent.created_at > last_ts)

                    result = await db.execute(
                        query.order_by(TelemetryEvent.created_at.asc()).limit(10)
                    )
                    events = result.scalars().all()

                for event in events:
                    last_event_id = event.id
                    yield _sse_event(
                        event.event_type,
                        {
                            "event_id": event.id,
                            "event_type": event.event_type,
                            "payload": event.payload,
                            "sprint_id": event.sprint_id,
                            "timestamp": event.created_at.isoformat(),
                        },
                    )

            # Keepalive comment every N seconds to prevent proxy timeouts
            keepalive_counter += 1
            if keepalive_counter >= (settings.sse_keepalive_seconds * 2):
                yield _sse_comment("keepalive")
                keepalive_counter = 0

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
            "Connection": "keep-alive",
        },
    )


# ─── SSE helpers ─────────────────────────────────────────────────────────────

def _sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    payload = json.dumps(data, default=str)
    return f"event: {event_type}\ndata: {payload}\n\n"


def _sse_comment(comment: str) -> str:
    """SSE comment — used for keepalive and connection messages."""
    return f": {comment}\n\n"
