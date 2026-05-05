"""
Unit tests for Pydantic v2 schemas — valid inputs, validation errors, and edge cases.
"""
import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.schemas.schemas import (
    UserCreate,
    UserOut,
    TokenResponse,
    APIKeyCreate,
    APIKeyOut,
    APIKeyCreated,
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    SpecCreate,
    SpecUpdate,
    SpecContent,
    SpecOut,
    SpecVersionOut,
    ADRCreate,
    ADRUpdate,
    ADROut,
    FitnessFunctionCreate,
    FitnessFunctionOut,
    CheckConfig,
    BoundedContextCreate,
    BoundedContextOut,
    IterationCreate,
    IterationUpdate,
    IterationOut,
    StageAdvanceRequest,
    CheckpointCreate,
    CheckpointResolve,
    CheckpointOut,
    AIContextRequest,
    AIContextResponse,
    FitnessRunRequest,
    FitnessRunResult,
    FitnessRunResponse,
    TelemetryEventOut,
    LoopMetricOut,
    ProjectHealthOut,
    PaginationParams,
    PaginatedResponse,
    ErrorResponse,
    ErrorDetail,
    SpecFormat,
    SpecStatus,
    ADRStatus,
    FitnessSeverity,
    FitnessResult,
    IterationStage,
    IterationStatus,
    CheckpointStatus,
)


# ─── UserCreate ───────────────────────────────────────────────────────────────

class TestUserCreate:
    def test_valid(self):
        u = UserCreate(email="test@example.com", password="password123")
        assert u.email == "test@example.com"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            UserCreate(password="password123")

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@example.com")

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="password123")

    def test_password_too_short(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@example.com", password="short")

    def test_password_max_length(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@example.com", password="x" * 129)

    def test_valid_min_password(self):
        u = UserCreate(email="test@example.com", password="abcdefgh")
        assert len(u.password) == 8

    def test_full_name_optional(self):
        u = UserCreate(email="test@example.com", password="password123", full_name="Jane")
        assert u.full_name == "Jane"

    def test_full_name_none(self):
        u = UserCreate(email="test@example.com", password="password123")
        assert u.full_name is None


# ─── TokenResponse ────────────────────────────────────────────────────────────

class TestTokenResponse:
    def test_valid(self):
        t = TokenResponse(
            access_token="eyJ...",
            refresh_token="dGhpcy...",
            token_type="bearer",
            expires_in=3600,
        )
        assert t.token_type == "bearer"
        assert t.expires_in == 3600

    def test_default_token_type(self):
        t = TokenResponse(
            access_token="a",
            refresh_token="b",
            expires_in=3600,
        )
        assert t.token_type == "bearer"


# ─── APIKeyCreate ─────────────────────────────────────────────────────────────

class TestAPIKeyCreate:
    def test_valid(self):
        k = APIKeyCreate(name="my-key")
        assert k.name == "my-key"

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            APIKeyCreate(name="x" * 101)

    def test_empty_name(self):
        with pytest.raises(ValidationError):
            APIKeyCreate(name="")

    def test_expires_at_optional(self):
        k = APIKeyCreate(name="my-key")
        assert k.expires_at is None


# ─── ProjectCreate ────────────────────────────────────────────────────────────

class TestProjectCreate:
    def test_valid_minimal(self):
        p = ProjectCreate(name="My Project", slug="my-project")
        assert p.domain is None

    def test_valid_full(self):
        p = ProjectCreate(name="My Project", slug="my-project", domain="fintech")
        assert p.domain == "fintech"

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            ProjectCreate(slug="my-project")

    def test_missing_slug(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="My Project")

    def test_slug_too_long(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="My Project", slug="x" * 201)

    def test_slug_pattern_invalid(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="My Project", slug="MY_PROJECT")

    def test_slug_pattern_rejects_uppercase(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="My Project", slug="My-Project")

    def test_slug_with_valid_chars(self):
        p = ProjectCreate(name="My Project", slug="my-project-123")
        assert p.slug == "my-project-123"

    def test_metadata_default(self):
        p = ProjectCreate(name="My Project", slug="my-project")
        assert p.metadata == {}


# ─── ProjectUpdate ────────────────────────────────────────────────────────────

class TestProjectUpdate:
    def test_empty_update(self):
        u = ProjectUpdate()
        assert u.name is None

    def test_partial_update(self):
        u = ProjectUpdate(name="New Name")
        assert u.name == "New Name"


# ─── SpecContent ──────────────────────────────────────────────────────────────

class TestSpecContent:
    def test_free_text(self):
        c = SpecContent(free_text="Build it nicely")
        assert c.free_text == "Build it nicely"

    def test_bdd_scenarios(self):
        c = SpecContent(
            bdd_scenarios=[{
                "title": "Happy path",
                "given": ["user exists"],
                "when": ["user logs in"],
                "then": ["user gets token"],
            }]
        )
        assert len(c.bdd_scenarios) == 1

    def test_cdc_contracts(self):
        c = SpecContent(
            cdc_contracts=[{
                "method": "GET",
                "path": "/users",
                "responses": {"200": {"schema": {}}},
            }]
        )
        assert len(c.cdc_contracts) == 1

    def test_example_tables(self):
        c = SpecContent(
            example_tables=[{
                "columns": ["a", "b"],
                "rows": [["1", "2"]],
            }]
        )
        assert len(c.example_tables) == 1

    def test_acceptance_criteria_default(self):
        c = SpecContent(free_text="x")
        assert c.acceptance_criteria == []

    def test_out_of_scope_default(self):
        c = SpecContent(free_text="x")
        assert c.out_of_scope == []


# ─── SpecCreate ───────────────────────────────────────────────────────────────

class TestSpecCreate:
    def test_valid_free(self):
        s = SpecCreate(
            title="Free spec",
            slug="free",
            content=SpecContent(free_text="Build it nicely"),
        )
        assert s.format == SpecFormat.FREE

    def test_valid_bdd(self):
        s = SpecCreate(
            title="Login",
            slug="login",
            format=SpecFormat.BDD,
            content=SpecContent(
                bdd_scenarios=[{
                    "title": "Happy path",
                    "given": ["user exists"],
                    "when": ["user logs in"],
                    "then": ["user gets token"],
                }],
            ),
        )
        assert s.format == SpecFormat.BDD

    def test_valid_cdc(self):
        s = SpecCreate(
            title="CDC spec",
            slug="cdc",
            format=SpecFormat.CDC,
            content=SpecContent(
                cdc_contracts=[{
                    "method": "GET",
                    "path": "/users",
                    "responses": {"200": {"schema": {}}},
                }]
            ),
        )
        assert s.format == SpecFormat.CDC

    def test_missing_title(self):
        with pytest.raises(ValidationError):
            SpecCreate(slug="s", content=SpecContent(free_text="c"))

    def test_missing_slug(self):
        with pytest.raises(ValidationError):
            SpecCreate(title="T", content=SpecContent(free_text="c"))

    def test_slug_too_long(self):
        with pytest.raises(ValidationError):
            SpecCreate(title="T", slug="x" * 301, content=SpecContent(free_text="c"))

    def test_slug_pattern_invalid(self):
        with pytest.raises(ValidationError):
            SpecCreate(title="T", slug="INVALID_SLUG", content=SpecContent(free_text="c"))

    def test_linked_adr_ids_default(self):
        s = SpecCreate(title="T", slug="s", content=SpecContent(free_text="c"))
        assert s.linked_adr_ids == []

    def test_tags_default(self):
        s = SpecCreate(title="T", slug="s", content=SpecContent(free_text="c"))
        assert s.tags == []


# ─── SpecUpdate ───────────────────────────────────────────────────────────────

class TestSpecUpdate:
    def test_valid_content_update(self):
        u = SpecUpdate(content=SpecContent(free_text="new"))
        assert u.content.free_text == "new"

    def test_title_update(self):
        u = SpecUpdate(title="New Title")
        assert u.title == "New Title"

    def test_status_update(self):
        u = SpecUpdate(status=SpecStatus.ACTIVE)
        assert u.status == SpecStatus.ACTIVE

    def test_empty_update(self):
        u = SpecUpdate()
        assert u.title is None


# ─── ADRCreate ────────────────────────────────────────────────────────────────

class TestADRCreate:
    def test_valid(self):
        a = ADRCreate(
            title="Use Postgres",
            context="We need a relational DB",
            decision="Postgres is the best",
            consequences="Need migrations",
        )
        assert a.title == "Use Postgres"

    def test_missing_context(self):
        with pytest.raises(ValidationError):
            ADRCreate(
                title="ADR",
                decision="dec",
                consequences="cons",
            )

    def test_missing_decision(self):
        with pytest.raises(ValidationError):
            ADRCreate(
                title="ADR",
                context="ctx",
                consequences="cons",
            )

    def test_missing_consequences(self):
        with pytest.raises(ValidationError):
            ADRCreate(
                title="ADR",
                context="ctx",
                decision="dec",
            )

    def test_tags_default(self):
        a = ADRCreate(
            title="ADR",
            context="ctx",
            decision="dec",
            consequences="cons",
        )
        assert a.tags == []

    def test_with_tags(self):
        a = ADRCreate(
            title="ADR",
            context="ctx",
            decision="dec",
            consequences="cons",
            tags=["database", "infra"],
        )
        assert len(a.tags) == 2


# ─── ADRUpdate ────────────────────────────────────────────────────────────────

class TestADRUpdate:
    def test_valid_status_change(self):
        u = ADRUpdate(status=ADRStatus.ACCEPTED)
        assert u.status == ADRStatus.ACCEPTED

    def test_all_fields(self):
        u = ADRUpdate(
            title="New title",
            context="new ctx",
            decision="new dec",
            consequences="new cons",
            alternatives_considered="new alt",
            status=ADRStatus.SUPERSEDED,
        )
        assert u.title == "New title"

    def test_empty_update(self):
        u = ADRUpdate()
        assert u.title is None


# ─── FitnessFunctionCreate ────────────────────────────────────────────────────

class TestFitnessFunctionCreate:
    def test_valid_regex(self):
        f = FitnessFunctionCreate(
            name="No direct DB",
            severity=FitnessSeverity.ERROR,
            check_type="regex",
            check_config=CheckConfig(pattern="from app.db", file_glob="**/*.py", should_match=False),
        )
        assert f.check_type == "regex"

    def test_valid_dependency_limit(self):
        f = FitnessFunctionCreate(
            name="Max deps",
            severity=FitnessSeverity.WARNING,
            check_type="dependency_limit",
            check_config=CheckConfig(max_dependencies=5, file_glob="**/*.py"),
        )
        assert f.check_config.max_dependencies == 5

    def test_valid_custom_script(self):
        f = FitnessFunctionCreate(
            name="Run linter",
            severity=FitnessSeverity.INFO,
            check_type="custom_script",
            check_config=CheckConfig(script="npm run lint", script_language="bash"),
        )
        assert f.check_config.script_language == "bash"

    def test_invalid_severity_string(self):
        with pytest.raises(ValidationError):
            FitnessFunctionCreate(
                name="Test",
                severity="critical",
                check_type="regex",
                check_config=CheckConfig(),
            )

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            FitnessFunctionCreate(
                name="x" * 201,
                severity=FitnessSeverity.ERROR,
                check_type="regex",
                check_config=CheckConfig(),
            )

    def test_invalid_check_type(self):
        with pytest.raises(ValidationError):
            FitnessFunctionCreate(
                name="Test",
                check_type="invalid_type",
                check_config=CheckConfig(),
            )

    def test_default_severity(self):
        f = FitnessFunctionCreate(
            name="Test",
            check_type="regex",
            check_config=CheckConfig(),
        )
        assert f.severity == FitnessSeverity.ERROR


# ─── BoundedContextCreate ─────────────────────────────────────────────────────

class TestBoundedContextCreate:
    def test_valid(self):
        bc = BoundedContextCreate(
            name="Auth Service",
            description="Handles auth",
            includes="Login, logout",
            excludes="Billing",
        )
        assert bc.name == "Auth Service"

    def test_missing_name(self):
        with pytest.raises(ValidationError):
            BoundedContextCreate(description="desc")

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            BoundedContextCreate(name="x" * 201)

    def test_interfaces_default(self):
        bc = BoundedContextCreate(name="Auth")
        assert bc.interfaces == {}


# ─── IterationCreate ──────────────────────────────────────────────────────────

class TestIterationCreate:
    def test_valid_minimal(self):
        i = IterationCreate(name="Sprint 1")
        assert i.name == "Sprint 1"
        assert i.spec_ids == []
        assert i.active_adr_ids == []

    def test_full(self):
        i = IterationCreate(
            name="Sprint 2",
            goal="Build auth",
            spec_ids=["id1", "id2"],
            active_adr_ids=["id3"],
        )
        assert len(i.spec_ids) == 2
        assert len(i.active_adr_ids) == 1

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            IterationCreate(name="x" * 201)

    def test_name_empty(self):
        with pytest.raises(ValidationError):
            IterationCreate(name="")


# ─── IterationUpdate ──────────────────────────────────────────────────────────

class TestIterationUpdate:
    def test_partial(self):
        u = IterationUpdate(name="New name")
        assert u.name == "New name"

    def test_empty(self):
        u = IterationUpdate()
        assert u.name is None


# ─── StageAdvanceRequest ──────────────────────────────────────────────────────

class TestStageAdvanceRequest:
    def test_normal_advance(self):
        a = StageAdvanceRequest()
        assert a.force is False

    def test_force_with_reason(self):
        a = StageAdvanceRequest(force=True, force_reason="Hotfix")
        assert a.force is True
        assert a.force_reason == "Hotfix"

    def test_notes(self):
        a = StageAdvanceRequest(notes="Looking good")
        assert a.notes == "Looking good"


# ─── CheckpointResolve ────────────────────────────────────────────────────────

class TestCheckpointResolve:
    def test_approved(self):
        r = CheckpointResolve(status=CheckpointStatus.APPROVED, resolution_notes="Looks good")
        assert r.status == CheckpointStatus.APPROVED

    def test_rejected(self):
        r = CheckpointResolve(status=CheckpointStatus.REJECTED, resolution_notes="Needs work")
        assert r.status == CheckpointStatus.REJECTED

    def test_skipped_with_reason(self):
        r = CheckpointResolve(
            status=CheckpointStatus.SKIPPED,
            skip_reason="Emergency bypass",
        )
        assert r.status == CheckpointStatus.SKIPPED
        assert r.skip_reason == "Emergency bypass"


# ─── AIContextRequest ─────────────────────────────────────────────────────────

class TestAIContextRequest:
    def test_valid(self):
        r = AIContextRequest(
            spec_ids=["id1"],
            format="markdown",
            include_fitness_constraints=True,
        )
        assert r.format == "markdown"

    def test_default_format(self):
        r = AIContextRequest(spec_ids=[])
        assert r.format == "markdown"

    def test_json_format(self):
        r = AIContextRequest(spec_ids=[], format="json")
        assert r.format == "json"

    def test_yaml_format(self):
        r = AIContextRequest(spec_ids=[], format="yaml")
        assert r.format == "yaml"

    def test_invalid_format(self):
        with pytest.raises(ValidationError):
            AIContextRequest(spec_ids=[], format="xml")

    def test_missing_spec_ids(self):
        with pytest.raises(ValidationError):
            AIContextRequest(format="markdown")


# ─── FitnessRunRequest ────────────────────────────────────────────────────────

class TestFitnessRunRequest:
    def test_valid(self):
        r = FitnessRunRequest(triggered_by="ci")
        assert r.triggered_by == "ci"

    def test_default_triggered_by(self):
        r = FitnessRunRequest()
        assert r.triggered_by == "api"

    def test_with_function_ids(self):
        r = FitnessRunRequest(function_ids=["f1", "f2"])
        assert len(r.function_ids) == 2


# ─── PaginationParams ─────────────────────────────────────────────────────────

class TestPaginationParams:
    def test_defaults(self):
        p = PaginationParams()
        assert p.page == 1
        assert p.page_size == 20

    def test_offset_calculation(self):
        p = PaginationParams(page=3, page_size=10)
        assert p.offset == 20

    def test_first_page_offset(self):
        p = PaginationParams()
        assert p.offset == 0

    def test_page_min(self):
        with pytest.raises(ValidationError):
            PaginationParams(page=0)

    def test_page_size_min(self):
        with pytest.raises(ValidationError):
            PaginationParams(page_size=0)

    def test_page_size_max(self):
        with pytest.raises(ValidationError):
            PaginationParams(page_size=101)


# ─── Enums ────────────────────────────────────────────────────────────────────

class TestEnums:
    def test_spec_format_values(self):
        assert SpecFormat.FREE.value == "free"
        assert SpecFormat.BDD.value == "bdd"
        assert SpecFormat.CDC.value == "cdc"
        assert SpecFormat.EXAMPLE.value == "example"

    def test_spec_status_values(self):
        assert SpecStatus.DRAFT.value == "draft"
        assert SpecStatus.ACTIVE.value == "active"
        assert SpecStatus.DEPRECATED.value == "deprecated"

    def test_adr_status_values(self):
        assert ADRStatus.PROPOSED.value == "proposed"
        assert ADRStatus.ACCEPTED.value == "accepted"
        assert ADRStatus.SUPERSEDED.value == "superseded"
        assert ADRStatus.DEPRECATED.value == "deprecated"
        assert ADRStatus.REJECTED.value == "rejected"

    def test_fitness_severity_values(self):
        assert FitnessSeverity.INFO.value == "info"
        assert FitnessSeverity.WARNING.value == "warning"
        assert FitnessSeverity.ERROR.value == "error"

    def test_fitness_result_values(self):
        assert FitnessResult.PASS.value == "pass"
        assert FitnessResult.FAIL.value == "fail"
        assert FitnessResult.ERROR.value == "error"
        assert FitnessResult.SKIPPED.value == "skipped"

    def test_iteration_stage_values(self):
        assert IterationStage.DEFINE.value == "define"
        assert IterationStage.GENERATE.value == "generate"
        assert IterationStage.VALIDATE.value == "validate"
        assert IterationStage.SHIP.value == "ship"
        assert IterationStage.REFLECT.value == "reflect"

    def test_iteration_status_values(self):
        assert IterationStatus.ACTIVE.value == "active"
        assert IterationStatus.COMPLETED.value == "completed"
        assert IterationStatus.ABANDONED.value == "abandoned"

    def test_checkpoint_status_values(self):
        assert CheckpointStatus.PENDING.value == "pending"
        assert CheckpointStatus.APPROVED.value == "approved"
        assert CheckpointStatus.REJECTED.value == "rejected"
        assert CheckpointStatus.SKIPPED.value == "skipped"
