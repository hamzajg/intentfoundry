"""
IntentFoundry domain models.

Organised by the four core capabilities:
  - Project (shared root)
  - Intent:       Spec, SpecVersion
  - Architecture: ADR, FitnessFunction, BoundedContext
  - Loop:         Sprint, Checkpoint
  - Telemetry:    TelemetryEvent, LoopMetric
"""
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel, SoftDeleteMixin, new_ulid


# ─── Enumerations ────────────────────────────────────────────────────────────

class SpecFormat(str, enum.Enum):
    BDD = "bdd"                 # Given/When/Then
    CDC = "cdc"                 # Contract-Driven (HTTP contracts)
    EXAMPLE = "example"         # Example tables / boundary values
    FREE = "free"               # Unstructured — catch-all

class SpecStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"

class ADRStatus(str, enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    SUPERSEDED = "superseded"
    DEPRECATED = "deprecated"
    REJECTED = "rejected"

class FitnessSeverity(str, enum.Enum):
    ERROR = "error"             # Blocks pipeline
    WARNING = "warning"         # Alerts but does not block
    INFO = "info"               # Informational only

class FitnessResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"             # Function itself failed to execute
    SKIPPED = "skipped"

class SprintStage(str, enum.Enum):
    DEFINE = "define"
    GENERATE = "generate"
    VALIDATE = "validate"
    SHIP = "ship"
    REFLECT = "reflect"

class CheckpointStatus(str, enum.Enum):
    PENDING = "pending"         # Waiting for human action
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"         # Explicitly bypassed (requires reason)

class SprintStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


# ─── Project ──────────────────────────────────────────────────────────────────

class Project(BaseModel, SoftDeleteMixin):
    """
    Root aggregate. Every other entity belongs to a project.
    Domain-agnostic — can represent a software feature, a research project,
    a content campaign, or any knowledge-work context.
    """
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    domain: Mapped[str | None] = mapped_column(
        String(100),
        comment="Optional domain tag e.g. 'software', 'research', 'legal'"
    )
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    owner_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), nullable=False)

    # Relationships
    owner: Mapped["User"] = relationship(
        back_populates="owned_projects",
        foreign_keys=[owner_id],
        lazy="select",
    )
    specs: Mapped[list["Spec"]] = relationship(back_populates="project", lazy="select")
    adrs: Mapped[list["ADR"]] = relationship(back_populates="project", lazy="select")
    fitness_functions: Mapped[list["FitnessFunction"]] = relationship(back_populates="project")
    bounded_contexts: Mapped[list["BoundedContext"]] = relationship(back_populates="project")
    sprints: Mapped[list["Sprint"]] = relationship(back_populates="project", lazy="select")

    __table_args__ = (
        UniqueConstraint("slug", "owner_id", name="uq_projects_slug_owner"),
    )


# ─── Auth ─────────────────────────────────────────────────────────────────────

class User(BaseModel, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    api_keys: Mapped[list["APIKey"]] = relationship(back_populates="user", lazy="select")
    owned_projects: Mapped[list["Project"]] = relationship(
        back_populates="owner",
        foreign_keys="Project.owner_id",
        lazy="select",
    )


class APIKey(BaseModel):
    __tablename__ = "api_keys"

    user_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    prefix: Mapped[str] = mapped_column(String(12), nullable=False)   # first 8 chars (visible)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="api_keys")


# ─── Intent module ───────────────────────────────────────────────────────────

class Spec(BaseModel, SoftDeleteMixin):
    """
    A specification artefact — the primary input to the AI execution layer.
    Versioned: each save creates a SpecVersion, the Spec holds the current pointer.
    """
    __tablename__ = "specs"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    format: Mapped[SpecFormat] = mapped_column(
        Enum(SpecFormat, name="spec_format"), nullable=False, default=SpecFormat.FREE
    )
    status: Mapped[SpecStatus] = mapped_column(
        Enum(SpecStatus, name="spec_status"), nullable=False, default=SpecStatus.DRAFT
    )
    # The specification content — stored as structured JSON for BDD/CDC/EXAMPLE
    # or plain text for FREE format
    content: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # Denormalised current version number for fast queries
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    # Optional link to the ADRs that constrain this spec
    linked_adr_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Optional bounded context this spec belongs to
    bounded_context_id: Mapped[str | None] = mapped_column(
        String(26), ForeignKey("bounded_contexts.id"), nullable=True
    )
    tags: Mapped[list] = mapped_column(JSON, default=list)
    author_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="specs")
    versions: Mapped[list["SpecVersion"]] = relationship(
        back_populates="spec", order_by="SpecVersion.version_number.desc()"
    )
    bounded_context: Mapped["BoundedContext | None"] = relationship(lazy="select")

    __table_args__ = (
        UniqueConstraint("project_id", "slug", name="uq_specs_project_slug"),
    )


class SpecVersion(BaseModel):
    """Immutable snapshot of a Spec at a point in time."""
    __tablename__ = "spec_versions"

    spec_id: Mapped[str] = mapped_column(String(26), ForeignKey("specs.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), nullable=False)

    spec: Mapped["Spec"] = relationship(back_populates="versions")

    __table_args__ = (
        UniqueConstraint("spec_id", "version_number", name="uq_spec_versions_spec_version"),
    )


# ─── Architecture module ──────────────────────────────────────────────────────

class ADR(BaseModel, SoftDeleteMixin):
    """
    Architecture Decision Record.
    The living constraint that governs what AI agents can build within.
    Automatically injected into AI context when generating code for related specs.
    """
    __tablename__ = "adrs"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)   # ADR-001, ADR-002…
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[ADRStatus] = mapped_column(
        Enum(ADRStatus, name="adr_status"), nullable=False, default=ADRStatus.PROPOSED
    )
    # Structured content — context, decision, consequences, alternatives
    context: Mapped[str] = mapped_column(Text, nullable=False, default="")
    decision: Mapped[str] = mapped_column(Text, nullable=False, default="")
    consequences: Mapped[str] = mapped_column(Text, nullable=False, default="")
    alternatives_considered: Mapped[str | None] = mapped_column(Text)
    # If superseded, points to the new ADR
    superseded_by_id: Mapped[str | None] = mapped_column(
        String(26), ForeignKey("adrs.id"), nullable=True
    )
    tags: Mapped[list] = mapped_column(JSON, default=list)
    author_id: Mapped[str] = mapped_column(String(26), ForeignKey("users.id"), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="adrs")
    fitness_functions: Mapped[list["FitnessFunction"]] = relationship(back_populates="adr")

    __table_args__ = (
        UniqueConstraint("project_id", "number", name="uq_adrs_project_number"),
    )


class FitnessFunction(BaseModel, SoftDeleteMixin):
    """
    Automated architectural constraint check.
    Runs in CI on every pull request — fails the build if violated.
    Linked to an ADR to explain WHY the constraint exists.
    """
    __tablename__ = "fitness_functions"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    adr_id: Mapped[str | None] = mapped_column(
        String(26), ForeignKey("adrs.id"), nullable=True,
        comment="The ADR this function enforces — makes the 'why' explicit"
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[FitnessSeverity] = mapped_column(
        Enum(FitnessSeverity, name="fitness_severity"),
        nullable=False,
        default=FitnessSeverity.ERROR,
    )
    # The check definition — type determines how it's executed
    check_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="'regex', 'ast_rule', 'dependency_limit', 'custom_script', 'api_check'"
    )
    check_config: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict,
        comment="Type-specific configuration for the check"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Latest result cached here — detailed history in FitnessResult table
    last_result: Mapped[str | None] = mapped_column(String(20))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship(back_populates="fitness_functions")
    adr: Mapped["ADR | None"] = relationship(back_populates="fitness_functions")
    results: Mapped[list["FitnessFunctionResult"]] = relationship(back_populates="function")


class FitnessFunctionResult(BaseModel):
    """Immutable result of a single fitness function execution."""
    __tablename__ = "fitness_function_results"

    function_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("fitness_functions.id"), nullable=False
    )
    sprint_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("sprints.id"))
    result: Mapped[FitnessResult] = mapped_column(
        Enum(FitnessResult, name="fitness_result"), nullable=False
    )
    message: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    triggered_by: Mapped[str | None] = mapped_column(
        String(50), comment="'ci', 'manual', 'checkpoint', 'api'"
    )

    function: Mapped["FitnessFunction"] = relationship(back_populates="results")


class BoundedContext(BaseModel, SoftDeleteMixin):
    """
    Domain boundary that scopes AI agent prompts.
    Specs and ADRs belong to a context; AI generation is constrained to the context boundary.
    """
    __tablename__ = "bounded_contexts"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # What this context explicitly includes and excludes — used in AI prompt context
    includes: Mapped[str | None] = mapped_column(Text)
    excludes: Mapped[str | None] = mapped_column(Text)
    # External interfaces — what this context exposes or consumes
    interfaces: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="bounded_contexts")


# ─── Loop module ──────────────────────────────────────────────────────────────

class Sprint(BaseModel):
    """
    A single iteration of the AI-Agile loop.
    Progresses through five stages; each stage transition is a Checkpoint.
    """
    __tablename__ = "sprints"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    goal: Mapped[str | None] = mapped_column(Text)
    current_stage: Mapped[SprintStage] = mapped_column(
        Enum(SprintStage, name="sprint_stage"),
        nullable=False,
        default=SprintStage.DEFINE,
    )
    status: Mapped[SprintStatus] = mapped_column(
        Enum(SprintStatus, name="sprint_status"),
        nullable=False,
        default=SprintStatus.ACTIVE,
    )
    # Specs in scope for this sprint
    spec_ids: Mapped[list] = mapped_column(JSON, default=list)
    # ADRs to inject into AI context for this sprint
    active_adr_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Bounded context scope
    bounded_context_id: Mapped[str | None] = mapped_column(
        String(26), ForeignKey("bounded_contexts.id"), nullable=True
    )
    # Reflection notes from stage 5
    reflection_notes: Mapped[str | None] = mapped_column(Text)
    spec_learnings: Mapped[list] = mapped_column(
        JSON, default=list,
        comment="Spec improvements identified in the Reflect stage"
    )
    adr_learnings: Mapped[list] = mapped_column(
        JSON, default=list,
        comment="Architecture constraints to add or update after this sprint"
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship(back_populates="sprints")
    checkpoints: Mapped[list["Checkpoint"]] = relationship(
        back_populates="sprint", order_by="Checkpoint.created_at"
    )
    fitness_results: Mapped[list["FitnessFunctionResult"]] = relationship(
        foreign_keys="FitnessFunctionResult.sprint_id"
    )


class Checkpoint(BaseModel):
    """
    A human decision gate within a sprint stage transition.
    Structurally enforced — the sprint cannot advance to the next stage
    until the required checkpoint is resolved.
    """
    __tablename__ = "checkpoints"

    sprint_id: Mapped[str] = mapped_column(String(26), ForeignKey("sprints.id"), nullable=False)
    stage: Mapped[SprintStage] = mapped_column(
        Enum(SprintStage, name="sprint_stage_cp"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CheckpointStatus] = mapped_column(
        Enum(CheckpointStatus, name="checkpoint_status"),
        nullable=False,
        default=CheckpointStatus.PENDING,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    # Who acted on this checkpoint
    resolved_by_id: Mapped[str | None] = mapped_column(
        String(26), ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    # Skip reason — required when is_required=True and status=SKIPPED
    skip_reason: Mapped[str | None] = mapped_column(Text)

    sprint: Mapped["Sprint"] = relationship(back_populates="checkpoints")


# ─── Telemetry module ─────────────────────────────────────────────────────────

class TelemetryEvent(BaseModel):
    """
    Immutable event log — the raw source for loop health metrics.
    High-volume: writes are append-only, reads are aggregated.
    """
    __tablename__ = "telemetry_events"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    sprint_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("sprints.id"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Examples: spec.created, spec.rework_detected, checkpoint.approved,
    #           fitness.failed, stage.advanced, sprint.completed
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    actor_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("users.id"))
    source: Mapped[str | None] = mapped_column(
        String(50), comment="'api', 'ci', 'webhook', 'system'"
    )


class LoopMetric(BaseModel):
    """
    Aggregated loop health snapshot — computed from TelemetryEvents.
    One row per sprint, updated incrementally as events arrive.
    """
    __tablename__ = "loop_metrics"

    project_id: Mapped[str] = mapped_column(String(26), ForeignKey("projects.id"), nullable=False)
    sprint_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("sprints.id"), nullable=False, unique=True
    )
    # The four key health indicators from the blog series
    spec_rework_count: Mapped[int] = mapped_column(Integer, default=0)
    architecture_drift_count: Mapped[int] = mapped_column(Integer, default=0)
    review_cycle_seconds: Mapped[int | None] = mapped_column(Integer)
    reflect_stage_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Derived composite score (0–100, higher = healthier loop)
    loop_health_score: Mapped[int | None] = mapped_column(Integer)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
