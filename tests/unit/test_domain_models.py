"""
Unit tests for domain model constraints, enums, and SoftDeleteMixin behavior.
"""
import pytest
from datetime import datetime, timezone

from app.models.domain import (
    SpecFormat,
    SpecStatus,
    ADRStatus,
    FitnessSeverity,
    FitnessResult,
    IterationStage,
    IterationStatus,
    CheckpointStatus,
    BoundedContext,
)
from app.models.base import SoftDeleteMixin


# ─── Enum Values ─────────────────────────────────────────────────────────────

class TestSpecFormatEnum:
    def test_values(self):
        assert SpecFormat.FREE.value == "free"
        assert SpecFormat.BDD.value == "bdd"
        assert SpecFormat.CDC.value == "cdc"
        assert SpecFormat.EXAMPLE.value == "example"

    def test_string_comparison(self):
        assert SpecFormat.FREE == "free"


class TestSpecStatusEnum:
    def test_values(self):
        assert SpecStatus.DRAFT.value == "draft"
        assert SpecStatus.ACTIVE.value == "active"
        assert SpecStatus.DEPRECATED.value == "deprecated"


class TestADRStatusEnum:
    def test_valid_statuses(self):
        assert ADRStatus.PROPOSED.value == "proposed"
        assert ADRStatus.ACCEPTED.value == "accepted"
        assert ADRStatus.SUPERSEDED.value == "superseded"
        assert ADRStatus.DEPRECATED.value == "deprecated"
        assert ADRStatus.REJECTED.value == "rejected"

    def test_all_string_comparable(self):
        for status in ADRStatus:
            assert status == status.value


class TestFitnessSeverityEnum:
    def test_values(self):
        assert FitnessSeverity.INFO.value == "info"
        assert FitnessSeverity.WARNING.value == "warning"
        assert FitnessSeverity.ERROR.value == "error"

    def test_severity_weights(self):
        weights = {FitnessSeverity.ERROR: 1.0, FitnessSeverity.WARNING: 0.6, FitnessSeverity.INFO: 0.3}
        assert weights[FitnessSeverity.ERROR] > weights[FitnessSeverity.WARNING]
        assert weights[FitnessSeverity.WARNING] > weights[FitnessSeverity.INFO]


class TestFitnessResultEnum:
    def test_values(self):
        assert FitnessResult.PASS.value == "pass"
        assert FitnessResult.FAIL.value == "fail"
        assert FitnessResult.ERROR.value == "error"
        assert FitnessResult.SKIPPED.value == "skipped"


class TestIterationStageEnum:
    def test_values(self):
        assert IterationStage.DEFINE.value == "define"
        assert IterationStage.GENERATE.value == "generate"
        assert IterationStage.VALIDATE.value == "validate"
        assert IterationStage.SHIP.value == "ship"
        assert IterationStage.REFLECT.value == "reflect"

    def test_stage_order(self):
        stages = list(IterationStage)
        assert stages[0] == IterationStage.DEFINE
        assert stages[-1] == IterationStage.REFLECT


class TestIterationStatusEnum:
    def test_values(self):
        assert IterationStatus.ACTIVE.value == "active"
        assert IterationStatus.COMPLETED.value == "completed"
        assert IterationStatus.ABANDONED.value == "abandoned"


class TestCheckpointStatusEnum:
    def test_values(self):
        assert CheckpointStatus.PENDING.value == "pending"
        assert CheckpointStatus.APPROVED.value == "approved"
        assert CheckpointStatus.REJECTED.value == "rejected"
        assert CheckpointStatus.SKIPPED.value == "skipped"


# ─── SoftDeleteMixin ─────────────────────────────────────────────────────────

class TestSoftDeleteMixin:
    def test_soft_delete_sets_timestamp(self):
        obj = BoundedContext(
            id="id1",
            project_id="p1",
            name="Test",
            description="desc",
            includes="i",
            excludes="e",
        )
        assert obj.deleted_at is None
        assert obj.is_deleted is False
        before = datetime.now(timezone.utc)
        obj.soft_delete()
        after = datetime.now(timezone.utc)
        assert obj.deleted_at is not None
        assert before <= obj.deleted_at <= after
        assert obj.is_deleted is True

    def test_soft_delete_idempotent(self):
        obj = BoundedContext(
            id="id2",
            project_id="p1",
            name="Test",
            description="desc",
            includes="i",
            excludes="e",
        )
        obj.soft_delete()
        first_ts = obj.deleted_at
        obj.soft_delete()
        assert obj.deleted_at >= first_ts
