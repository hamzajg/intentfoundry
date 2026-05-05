"""
Unit tests for TelemetryService health score computation.
Tests the pure `_compute_health_score` function and mock-based service tests.
"""
from unittest.mock import MagicMock, AsyncMock

import pytest

from app.services.telemetry_service import _compute_health_score


# ─── Health Score Computation (pure function) ─────────────────────────────────

class TestComputeHealthScore:
    def test_perfect_score(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 100

    def test_one_rework(self):
        assert _compute_health_score(
            spec_rework_count=1,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 95

    def test_multiple_reworks(self):
        assert _compute_health_score(
            spec_rework_count=3,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 85

    def test_rework_penalty_capped_at_30(self):
        assert _compute_health_score(
            spec_rework_count=10,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 70

    def test_rework_cap_boundary(self):
        assert _compute_health_score(
            spec_rework_count=6,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 70

    def test_rework_just_under_cap(self):
        assert _compute_health_score(
            spec_rework_count=5,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        ) == 75

    def test_one_drift(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=1,
            reflect_stage_completed=True,
        ) == 90

    def test_multiple_drifts(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=3,
            reflect_stage_completed=True,
        ) == 70

    def test_drift_penalty_capped_at_40(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=10,
            reflect_stage_completed=True,
        ) == 60

    def test_drift_cap_boundary(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=4,
            reflect_stage_completed=True,
        ) == 60

    def test_drift_just_under_cap(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=3,
            reflect_stage_completed=True,
        ) == 70

    def test_missing_reflect_penalty(self):
        assert _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=0,
            reflect_stage_completed=False,
        ) == 80

    def test_combined_penalties(self):
        assert _compute_health_score(
            spec_rework_count=2,
            architecture_drift_count=1,
            reflect_stage_completed=False,
        ) == 60

    def test_all_penalties_maxed(self):
        # Caps: rework -30, drift -40, reflect -20 = -90
        assert _compute_health_score(
            spec_rework_count=100,
            architecture_drift_count=100,
            reflect_stage_completed=False,
        ) == 10

    def test_score_never_negative(self):
        # Max possible penalty is 30 + 40 + 20 = 90, so minimum score is 10
        assert _compute_health_score(
            spec_rework_count=50,
            architecture_drift_count=50,
            reflect_stage_completed=False,
        ) == 10

    def test_minimum_possible_score(self):
        assert _compute_health_score(
            spec_rework_count=999,
            architecture_drift_count=999,
            reflect_stage_completed=False,
        ) == 10

    def test_score_clamped_to_zero(self):
        score = _compute_health_score(
            spec_rework_count=1,
            architecture_drift_count=1,
            reflect_stage_completed=False,
        )
        assert score == 65
        assert 0 <= score <= 100


# ─── Telemetry Event Emission (mocked DB) ─────────────────────────────────────

class TestEmit:
    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.flush = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        from app.services.telemetry_service import TelemetryService
        return TelemetryService(db=mock_db)

    async def test_emit_creates_event_with_project_id(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="spec.created",
            payload={"spec_id": "s1"},
        )
        assert event.project_id == "p1"
        assert event.event_type == "spec.created"
        assert mock_db.add.called

    async def test_emit_includes_actor_id(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="spec.created",
            payload={"spec_id": "s1"},
            actor_id="u1",
        )
        assert event.actor_id == "u1"

    async def test_emit_includes_iteration_id_from_payload(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="stage.advanced",
            payload={"iteration_id": "i1"},
        )
        assert event.iteration_id == "i1"

    async def test_emit_explicit_iteration_id_overrides_payload(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="stage.advanced",
            payload={"iteration_id": "i2"},
            iteration_id="i1",
        )
        assert event.iteration_id == "i1"

    async def test_emit_default_source_is_api(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="spec.created",
            payload={},
        )
        assert event.source == "api"

    async def test_emit_custom_source(self, service, mock_db):
        event = await service.emit(
            project_id="p1",
            event_type="spec.created",
            payload={},
            source="cli",
        )
        assert event.source == "cli"
