"""
Telemetry service — event emission, metric computation, and project health.
"""
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    Checkpoint,
    CheckpointStatus,
    FitnessFunctionResult,
    FitnessResult,
    LoopMetric,
    Sprint,
    SprintStatus,
    TelemetryEvent,
)
from app.schemas.schemas import ProjectHealthOut


class TelemetryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def emit(
        self,
        project_id: str,
        event_type: str,
        payload: dict[str, Any],
        actor_id: str | None = None,
        sprint_id: str | None = None,
        source: str = "api",
    ) -> TelemetryEvent:
        """
        Emit a telemetry event. Append-only — events are never mutated.
        In production, also publishes to Redis pub/sub for SSE delivery.
        """
        event = TelemetryEvent(
            project_id=project_id,
            sprint_id=sprint_id or payload.get("sprint_id"),
            event_type=event_type,
            payload=payload,
            actor_id=actor_id,
            source=source,
        )
        self.db.add(event)
        await self.db.flush()

        # TODO Phase 2: publish to Redis pub/sub
        # if redis_enabled: await redis.publish(f"if:telemetry:{project_id}", event.json())

        return event

    async def compute_loop_metrics(
        self,
        project_id: str,
        sprint_id: str,
        force: bool = False,
    ) -> LoopMetric:
        """
        Compute and cache loop health metrics for a sprint.
        The four key indicators:
          1. spec_rework_count       — how many times specs were updated mid-sprint
          2. architecture_drift_count — fitness function failures
          3. review_cycle_seconds    — time from generate→ship checkpoint resolution
          4. reflect_stage_completed — was stage 5 actually done?
        """
        # Check for cached metric
        if not force:
            existing = await self.db.execute(
                select(LoopMetric).where(
                    LoopMetric.project_id == project_id,
                    LoopMetric.sprint_id == sprint_id,
                )
            )
            metric = existing.scalar_one_or_none()
            if metric:
                return metric

        # 1. Spec rework count — spec.updated events during this sprint
        rework_result = await self.db.execute(
            select(func.count(TelemetryEvent.id)).where(
                TelemetryEvent.project_id == project_id,
                TelemetryEvent.sprint_id == sprint_id,
                TelemetryEvent.event_type == "spec.updated",
            )
        )
        spec_rework_count = rework_result.scalar_one() or 0

        # 2. Architecture drift — fitness function failures during this sprint
        drift_result = await self.db.execute(
            select(func.count(FitnessFunctionResult.id)).where(
                FitnessFunctionResult.sprint_id == sprint_id,
                FitnessFunctionResult.result == FitnessResult.FAIL,
            )
        )
        architecture_drift_count = drift_result.scalar_one() or 0

        # 3. Review cycle time — GENERATE checkpoint approved → SHIP checkpoint approved
        generate_cp = await self.db.execute(
            select(Checkpoint).where(
                Checkpoint.sprint_id == sprint_id,
                Checkpoint.stage.in_(["generate"]),
                Checkpoint.status == CheckpointStatus.APPROVED,
            )
        )
        generate_checkpoint = generate_cp.scalar_one_or_none()

        ship_cp = await self.db.execute(
            select(Checkpoint).where(
                Checkpoint.sprint_id == sprint_id,
                Checkpoint.stage.in_(["ship"]),
                Checkpoint.status == CheckpointStatus.APPROVED,
            )
        )
        ship_checkpoint = ship_cp.scalar_one_or_none()

        review_cycle_seconds = None
        if generate_checkpoint and ship_checkpoint and generate_checkpoint.resolved_at and ship_checkpoint.resolved_at:
            delta = ship_checkpoint.resolved_at - generate_checkpoint.resolved_at
            review_cycle_seconds = int(delta.total_seconds())

        # 4. Reflect stage completion
        reflect_result = await self.db.execute(
            select(TelemetryEvent).where(
                TelemetryEvent.project_id == project_id,
                TelemetryEvent.sprint_id == sprint_id,
                TelemetryEvent.event_type == "sprint.reflection_updated",
            )
        )
        reflect_stage_completed = reflect_result.scalar_one_or_none() is not None

        # Compute composite health score (0–100)
        score = _compute_health_score(
            spec_rework_count=spec_rework_count,
            architecture_drift_count=architecture_drift_count,
            reflect_stage_completed=reflect_stage_completed,
        )

        # Upsert the metric
        existing_metric = await self.db.execute(
            select(LoopMetric).where(LoopMetric.sprint_id == sprint_id)
        )
        metric = existing_metric.scalar_one_or_none()

        if metric:
            metric.spec_rework_count = spec_rework_count
            metric.architecture_drift_count = architecture_drift_count
            metric.review_cycle_seconds = review_cycle_seconds
            metric.reflect_stage_completed = reflect_stage_completed
            metric.loop_health_score = score
            metric.computed_at = datetime.now(UTC)
        else:
            metric = LoopMetric(
                project_id=project_id,
                sprint_id=sprint_id,
                spec_rework_count=spec_rework_count,
                architecture_drift_count=architecture_drift_count,
                review_cycle_seconds=review_cycle_seconds,
                reflect_stage_completed=reflect_stage_completed,
                loop_health_score=score,
                computed_at=datetime.now(UTC),
            )
            self.db.add(metric)

        await self.db.flush()
        return metric

    async def compute_project_health(self, project_id: str) -> ProjectHealthOut:
        """Aggregate health across all sprints in a project."""
        sprints_result = await self.db.execute(
            select(Sprint).where(Sprint.project_id == project_id)
        )
        all_sprints = sprints_result.scalars().all()
        total = len(all_sprints)
        completed = sum(1 for s in all_sprints if s.status == SprintStatus.COMPLETED)

        # Aggregate metrics
        metrics_result = await self.db.execute(
            select(LoopMetric).where(LoopMetric.project_id == project_id)
        )
        metrics = metrics_result.scalars().all()

        avg_health = (
            sum(m.loop_health_score for m in metrics if m.loop_health_score is not None)
            / len([m for m in metrics if m.loop_health_score is not None])
            if metrics
            else None
        )
        avg_rework = sum(m.spec_rework_count for m in metrics) / len(metrics) if metrics else 0.0
        avg_drift = (
            sum(m.architecture_drift_count for m in metrics) / len(metrics) if metrics else 0.0
        )
        reflect_rate = (
            sum(1 for m in metrics if m.reflect_stage_completed) / len(metrics)
            if metrics
            else 0.0
        )

        # Recent fitness pass rate (last 30 days events)
        from datetime import timedelta
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        recent_fitness = await self.db.execute(
            select(TelemetryEvent).where(
                TelemetryEvent.project_id == project_id,
                TelemetryEvent.event_type.in_(
                    ["fitness.passed", "architecture.drift_detected"]
                ),
                TelemetryEvent.created_at >= thirty_days_ago,
            )
        )
        recent_events = recent_fitness.scalars().all()
        passed = sum(1 for e in recent_events if e.event_type == "fitness.passed")
        total_fitness = len(recent_events)
        fitness_pass_rate = passed / total_fitness if total_fitness > 0 else 1.0

        return ProjectHealthOut(
            project_id=project_id,
            total_sprints=total,
            completed_sprints=completed,
            avg_loop_health_score=avg_health,
            avg_spec_rework_count=avg_rework,
            avg_architecture_drift_count=avg_drift,
            reflect_stage_completion_rate=reflect_rate,
            recent_fitness_pass_rate=fitness_pass_rate,
            computed_at=datetime.now(UTC),
        )


def _compute_health_score(
    spec_rework_count: int,
    architecture_drift_count: int,
    reflect_stage_completed: bool,
) -> int:
    """
    Composite loop health score (0–100).
    Higher = healthier loop. Scoring rubric:
      - Base score: 100
      - Each spec rework: -5 (capped at -30)
      - Each architecture drift: -10 (capped at -40)
      - Reflect stage not completed: -20
    """
    penalty = 0
    penalty += min(spec_rework_count * 5, 30)
    penalty += min(architecture_drift_count * 10, 40)
    if not reflect_stage_completed:
        penalty += 20
    return max(100 - penalty, 0)
