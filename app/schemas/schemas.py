"""
Pydantic v2 schemas for request/response validation.
Organised by module — mirrors the domain model structure.
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.domain import (
    ADRStatus,
    CheckpointStatus,
    FitnessResult,
    FitnessSeverity,
    SpecFormat,
    SpecStatus,
    SprintStage,
    SprintStatus,
)


# ─── Shared base ─────────────────────────────────────────────────────────────

class APIBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(APIBase):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int


# ─── Auth schemas ─────────────────────────────────────────────────────────────

class UserCreate(APIBase):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)


class UserOut(APIBase):
    id: str
    email: str
    full_name: str | None
    is_active: bool
    created_at: datetime


class TokenResponse(APIBase):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class APIKeyCreate(APIBase):
    name: str = Field(min_length=1, max_length=100)
    expires_at: datetime | None = None


class APIKeyOut(APIBase):
    id: str
    name: str
    prefix: str           # First chars of the key (safe to show)
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    is_active: bool


class APIKeyCreated(APIKeyOut):
    """Returned only once on creation — includes the full key."""
    key: str


# ─── Project schemas ──────────────────────────────────────────────────────────

class ProjectCreate(APIBase):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    domain: str | None = Field(default=None, max_length=100)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("slug")
    @classmethod
    def slug_lowercase(cls, v: str) -> str:
        return v.lower()


class ProjectUpdate(APIBase):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    domain: str | None = None
    metadata: dict[str, Any] | None = None


class ProjectOut(APIBase):
    id: str
    name: str
    slug: str
    description: str | None
    domain: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime


# ─── Intent module schemas ────────────────────────────────────────────────────

class BDDScenario(APIBase):
    """A single Given/When/Then scenario."""
    title: str = Field(max_length=300)
    given: list[str] = Field(default_factory=list)
    when: list[str] = Field(default_factory=list)
    then: list[str] = Field(default_factory=list)
    examples: list[dict[str, Any]] | None = None   # Scenario outline examples
    tags: list[str] = Field(default_factory=list)


class CDCContract(APIBase):
    """HTTP contract definition."""
    method: str = Field(pattern=r"^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$")
    path: str
    request_body: dict[str, Any] | None = None
    request_headers: dict[str, str] = Field(default_factory=dict)
    responses: dict[str, dict[str, Any]] = Field(
        description="Status code → response schema, e.g. {'200': {'schema': {...}}}"
    )
    description: str | None = None


class ExampleTable(APIBase):
    """Structured example table for boundary-value specifications."""
    description: str | None = None
    columns: list[str]
    rows: list[list[Any]]


class SpecContent(APIBase):
    """
    Format-aware spec content.
    Exactly one of bdd_scenarios / cdc_contracts / example_tables / free_text
    should be populated based on the format field.
    """
    # BDD format
    bdd_scenarios: list[BDDScenario] | None = None
    # CDC format
    cdc_contracts: list[CDCContract] | None = None
    # EXAMPLE format
    example_tables: list[ExampleTable] | None = None
    # FREE format — plain markdown/text
    free_text: str | None = None
    # Shared across formats
    acceptance_criteria: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)
    notes: str | None = None


class SpecCreate(APIBase):
    title: str = Field(min_length=1, max_length=300)
    slug: str = Field(min_length=1, max_length=300, pattern=r"^[a-z0-9-]+$")
    format: SpecFormat = SpecFormat.FREE
    content: SpecContent
    linked_adr_ids: list[str] = Field(default_factory=list)
    bounded_context_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    change_summary: str | None = Field(
        default=None, description="Summary of changes for the version history"
    )


class SpecUpdate(APIBase):
    title: str | None = Field(default=None, max_length=300)
    format: SpecFormat | None = None
    content: SpecContent | None = None
    status: SpecStatus | None = None
    linked_adr_ids: list[str] | None = None
    bounded_context_id: str | None = None
    tags: list[str] | None = None
    change_summary: str | None = None


class SpecVersionOut(APIBase):
    id: str
    spec_id: str
    version_number: int
    content: dict[str, Any]
    change_summary: str | None
    author_id: str
    created_at: datetime


class SpecOut(APIBase):
    id: str
    project_id: str
    title: str
    slug: str
    format: SpecFormat
    status: SpecStatus
    content: dict[str, Any]
    current_version: int
    linked_adr_ids: list[str]
    bounded_context_id: str | None
    tags: list[str]
    author_id: str
    created_at: datetime
    updated_at: datetime


# ─── Architecture module schemas ──────────────────────────────────────────────

class ADRCreate(APIBase):
    title: str = Field(min_length=1, max_length=300)
    context: str = Field(min_length=1, description="What led to this decision")
    decision: str = Field(min_length=1, description="The decision itself")
    consequences: str = Field(min_length=1, description="Resulting context and trade-offs")
    alternatives_considered: str | None = None
    tags: list[str] = Field(default_factory=list)


class ADRUpdate(APIBase):
    title: str | None = Field(default=None, max_length=300)
    status: ADRStatus | None = None
    context: str | None = None
    decision: str | None = None
    consequences: str | None = None
    alternatives_considered: str | None = None
    superseded_by_id: str | None = None
    tags: list[str] | None = None


class ADROut(APIBase):
    id: str
    project_id: str
    number: int
    title: str
    status: ADRStatus
    context: str
    decision: str
    consequences: str
    alternatives_considered: str | None
    superseded_by_id: str | None
    tags: list[str]
    author_id: str
    created_at: datetime
    updated_at: datetime


class CheckConfig(APIBase):
    """
    Type-specific configuration for a fitness function check.
    The fields used depend on check_type.
    """
    # For 'regex' checks
    pattern: str | None = None
    file_glob: str | None = None
    should_match: bool | None = None     # True = must match, False = must not match

    # For 'dependency_limit' checks
    max_dependencies: int | None = None
    scope: str | None = None             # 'module', 'package', 'service'

    # For 'custom_script' checks
    script: str | None = None            # Inline script body
    script_language: str | None = None   # 'python', 'bash'

    # For 'api_check' checks (CI webhook integration)
    endpoint: str | None = None
    expected_status: int | None = None
    payload_schema: dict[str, Any] | None = None

    # Shared
    timeout_seconds: int = 30
    extra: dict[str, Any] = Field(default_factory=dict)


class FitnessFunctionCreate(APIBase):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    adr_id: str | None = Field(
        default=None,
        description="Link to the ADR this function enforces — makes the 'why' explicit"
    )
    severity: FitnessSeverity = FitnessSeverity.ERROR
    check_type: str = Field(
        pattern=r"^(regex|ast_rule|dependency_limit|custom_script|api_check)$"
    )
    check_config: CheckConfig


class FitnessFunctionUpdate(APIBase):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    severity: FitnessSeverity | None = None
    check_config: CheckConfig | None = None
    is_active: bool | None = None


class FitnessFunctionOut(APIBase):
    id: str
    project_id: str
    adr_id: str | None
    name: str
    description: str | None
    severity: FitnessSeverity
    check_type: str
    check_config: dict[str, Any]
    is_active: bool
    last_result: str | None
    last_run_at: datetime | None
    created_at: datetime


class FitnessRunRequest(APIBase):
    function_ids: list[str] | None = Field(
        default=None,
        description="If omitted, runs all active functions for the project"
    )
    sprint_id: str | None = None
    triggered_by: str = "api"


class FitnessRunResult(APIBase):
    function_id: str
    function_name: str
    result: FitnessResult
    severity: FitnessSeverity
    message: str | None
    details: dict[str, Any]
    duration_ms: int


class FitnessRunResponse(APIBase):
    project_id: str
    sprint_id: str | None
    results: list[FitnessRunResult]
    passed: int
    failed: int
    errors: int
    skipped: int
    run_at: datetime


class BoundedContextCreate(APIBase):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    includes: str | None = None
    excludes: str | None = None
    interfaces: dict[str, Any] = Field(default_factory=dict)


class BoundedContextOut(APIBase):
    id: str
    project_id: str
    name: str
    description: str | None
    includes: str | None
    excludes: str | None
    interfaces: dict[str, Any]
    created_at: datetime


# ─── Context builder schema ───────────────────────────────────────────────────

class AIContextRequest(APIBase):
    """
    Request to build an AI-ready context package.
    Returns the spec + relevant ADRs + bounded context constraints
    formatted for injection into an AI agent prompt.
    """
    spec_ids: list[str]
    adr_ids: list[str] | None = None   # If None, auto-selects linked ADRs
    bounded_context_id: str | None = None
    include_fitness_constraints: bool = True
    format: str = Field(
        default="markdown",
        pattern=r"^(markdown|json|yaml)$",
        description="Output format for the context package"
    )


class AIContextResponse(APIBase):
    project_id: str
    context_package: str     # The formatted context ready for prompt injection
    spec_count: int
    adr_count: int
    fitness_constraint_count: int
    token_estimate: int      # Rough token count for LLM budget planning
    generated_at: datetime


# ─── Loop module schemas ──────────────────────────────────────────────────────

class SprintCreate(APIBase):
    name: str = Field(min_length=1, max_length=200)
    goal: str | None = None
    spec_ids: list[str] = Field(default_factory=list)
    active_adr_ids: list[str] = Field(default_factory=list)
    bounded_context_id: str | None = None


class SprintUpdate(APIBase):
    name: str | None = Field(default=None, max_length=200)
    goal: str | None = None
    spec_ids: list[str] | None = None
    active_adr_ids: list[str] | None = None


class StageAdvanceRequest(APIBase):
    """Request to advance a sprint to the next stage."""
    notes: str | None = Field(
        default=None,
        description="Optional notes for the stage transition — stored in checkpoint"
    )
    force: bool = Field(
        default=False,
        description="Skip pending checkpoints (requires reason)"
    )
    force_reason: str | None = None


class SprintReflectionUpdate(APIBase):
    """Stage 5 — Reflect payload."""
    reflection_notes: str
    spec_learnings: list[str] = Field(default_factory=list)
    adr_learnings: list[str] = Field(default_factory=list)


class SprintOut(APIBase):
    id: str
    project_id: str
    name: str
    goal: str | None
    current_stage: SprintStage
    status: SprintStatus
    spec_ids: list[str]
    active_adr_ids: list[str]
    bounded_context_id: str | None
    reflection_notes: str | None
    spec_learnings: list[str]
    adr_learnings: list[str]
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CheckpointCreate(APIBase):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    stage: SprintStage
    is_required: bool = True


class CheckpointResolve(APIBase):
    status: CheckpointStatus
    resolution_notes: str | None = None
    skip_reason: str | None = Field(
        default=None,
        description="Required when status=SKIPPED and is_required=True"
    )


class CheckpointOut(APIBase):
    id: str
    sprint_id: str
    stage: SprintStage
    title: str
    description: str | None
    status: CheckpointStatus
    is_required: bool
    resolved_by_id: str | None
    resolved_at: datetime | None
    resolution_notes: str | None
    skip_reason: str | None
    created_at: datetime


# ─── Telemetry schemas ────────────────────────────────────────────────────────

class TelemetryEventOut(APIBase):
    id: str
    project_id: str
    sprint_id: str | None
    event_type: str
    payload: dict[str, Any]
    actor_id: str | None
    source: str | None
    created_at: datetime


class LoopMetricOut(APIBase):
    id: str
    project_id: str
    sprint_id: str
    spec_rework_count: int
    architecture_drift_count: int
    review_cycle_seconds: int | None
    reflect_stage_completed: bool
    loop_health_score: int | None
    computed_at: datetime | None


class ProjectHealthOut(APIBase):
    """Aggregated health across all sprints in a project."""
    project_id: str
    total_sprints: int
    completed_sprints: int
    avg_loop_health_score: float | None
    avg_spec_rework_count: float
    avg_architecture_drift_count: float
    reflect_stage_completion_rate: float    # 0–1
    recent_fitness_pass_rate: float         # 0–1, last 30 days
    computed_at: datetime


# ─── Error schemas ────────────────────────────────────────────────────────────

class ErrorDetail(APIBase):
    field: str | None = None
    message: str


class ErrorResponse(APIBase):
    error: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str | None = None
