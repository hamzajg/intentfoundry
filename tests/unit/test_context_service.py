"""
Unit tests for ContextBuilderService renderers — pure logic, no database.
"""
import json

import pytest

from app.models.domain import (
    ADR,
    ADRStatus,
    BoundedContext,
    Spec,
    SpecFormat,
)
from app.services.context_service import (
    _render_json,
    _render_markdown,
    _render_yaml,
)


def _make_spec(title="Test", slug="test", fmt=SpecFormat.FREE, content=None):
    if content is None:
        content = {"free_text": "Build it nicely"}
    return Spec(
        id=f"id-{title.lower().replace(' ', '-')}",
        project_id="p1",
        title=title,
        slug=slug,
        format=fmt,
        content=content,
    )


def _make_adr(title="ADR Title", number=1, status=ADRStatus.ACCEPTED):
    return ADR(
        id=f"id-adr-{number}",
        project_id="p1",
        title=title,
        number=number,
        context="ctx",
        decision="dec",
        consequences="cons",
        status=status,
    )


def _make_context(name="Auth"):
    return BoundedContext(
        id="bc1",
        project_id="p1",
        name=name,
        description="Handles auth",
        includes="Login",
        excludes="Billing",
    )


# ─── Markdown Renderer ───────────────────────────────────────────────────────

class TestRenderMarkdown:
    def test_header_present(self):
        out = _render_markdown([], [], None, [])
        assert "# IntentFoundry Context Package" in out

    def test_empty_package(self):
        out = _render_markdown([], [], None, [])
        assert "End of IntentFoundry context package" in out

    def test_free_text_spec(self):
        spec = _make_spec(content={"free_text": "Build login"})
        out = _render_markdown([spec], [], None, [])
        assert "Build login" in out

    def test_bdd_spec_renders_scenarios(self):
        spec = _make_spec(
            fmt=SpecFormat.BDD,
            content={
                "bdd_scenarios": [
                    {
                        "title": "Happy path",
                        "given": ["user exists"],
                        "when": ["user logs in"],
                        "then": ["user gets token"],
                    }
                ],
            },
        )
        out = _render_markdown([spec], [], None, [])
        assert "Given user exists" in out
        assert "When user logs in" in out
        assert "Then user gets token" in out

    def test_cdc_spec_renders_contracts(self):
        spec = _make_spec(
            fmt=SpecFormat.CDC,
            content={
                "cdc_contracts": [
                    {"method": "GET", "path": "/users"},
                ]
            },
        )
        out = _render_markdown([spec], [], None, [])
        assert "GET /users" in out

    def test_example_spec_renders_tables(self):
        spec = _make_spec(
            fmt=SpecFormat.EXAMPLE,
            content={
                "example_tables": [
                    {
                        "description": "Login matrix",
                        "columns": ["Email", "Password", "Result"],
                        "rows": [
                            ["a@b.com", "pass", "success"],
                        ],
                    }
                ]
            },
        )
        out = _render_markdown([spec], [], None, [])
        assert "Login matrix" in out
        assert "Email" in out

    def test_acceptance_criteria_rendered(self):
        spec = _make_spec(
            content={
                "free_text": "Build login",
                "acceptance_criteria": ["Token expires in 24h"],
            }
        )
        out = _render_markdown([spec], [], None, [])
        assert "**Acceptance criteria:**" in out
        assert "- Token expires in 24h" in out

    def test_out_of_scope_rendered(self):
        spec = _make_spec(
            content={
                "free_text": "Build login",
                "out_of_scope": ["Billing integration"],
            }
        )
        out = _render_markdown([spec], [], None, [])
        assert "**Out of scope (do not implement):**" in out
        assert "- Billing integration" in out

    def test_adr_rendered(self):
        adr = _make_adr()
        out = _render_markdown([], [adr], None, [])
        assert "ADR-001: ADR Title" in out
        assert "**Decision:** dec" in out

    def test_adr_status_rendered(self):
        adr = _make_adr(status=ADRStatus.PROPOSED)
        out = _render_markdown([], [adr], None, [])
        assert "**Status:** proposed" in out

    def test_bounded_context_rendered(self):
        ctx = _make_context()
        out = _render_markdown([], [], ctx, [])
        assert "**Name:** Auth" in out
        assert "**Includes:**" in out
        assert "Login" in out
        assert "**Excludes (do NOT implement these):**" in out

    def test_fitness_constraints_rendered(self):
        constraints = ["[ERROR] No direct DB: regex"]
        out = _render_markdown([], [], None, constraints)
        assert "Architectural Constraints" in out
        assert "[ERROR] No direct DB: regex" in out

    def test_full_package(self):
        spec = _make_spec(
            content={"free_text": "Build auth", "acceptance_criteria": ["JWT tokens"]}
        )
        adr = _make_adr(number=1)
        ctx = _make_context()
        constraints = ["[WARNING] Max deps"]
        out = _render_markdown([spec], [adr], ctx, constraints)
        assert "# IntentFoundry Context Package" in out
        assert "Build auth" in out
        assert "- JWT tokens" in out
        assert "ADR-001" in out
        assert "**Name:** Auth" in out
        assert "[WARNING] Max deps" in out


# ─── JSON Renderer ───────────────────────────────────────────────────────────

class TestRenderJson:
    def test_valid_json(self):
        out = _render_json([], [], None, [])
        data = json.loads(out)
        assert "intentfoundry_context" in data

    def test_empty_specs_and_adrs(self):
        out = _render_json([], [], None, [])
        data = json.loads(out)
        ctx = data["intentfoundry_context"]
        assert ctx["specs"] == []
        assert ctx["adrs"] == []

    def test_includes_specs(self):
        spec = _make_spec(content={"free_text": "Build login"})
        out = _render_json([spec], [], None, [])
        data = json.loads(out)
        assert len(data["intentfoundry_context"]["specs"]) == 1
        assert data["intentfoundry_context"]["specs"][0]["title"] == "Test"

    def test_includes_adrs(self):
        adr = _make_adr(number=5, title="Use Redis")
        out = _render_json([], [adr], None, [])
        data = json.loads(out)
        assert len(data["intentfoundry_context"]["adrs"]) == 1
        assert data["intentfoundry_context"]["adrs"][0]["number"] == 5

    def test_includes_bounded_context(self):
        ctx = _make_context()
        out = _render_json([], [], ctx, [])
        data = json.loads(out)
        assert data["intentfoundry_context"]["bounded_context"] is not None
        assert data["intentfoundry_context"]["bounded_context"]["name"] == "Auth"

    def test_includes_fitness_constraints(self):
        constraints = ["[ERROR] test"]
        out = _render_json([], [], None, constraints)
        data = json.loads(out)
        assert data["intentfoundry_context"]["fitness_constraints"] == constraints

    def test_has_generated_at(self):
        out = _render_json([], [], None, [])
        data = json.loads(out)
        assert "generated_at" in data["intentfoundry_context"]


# ─── YAML Renderer ───────────────────────────────────────────────────────────

class TestRenderYaml:
    def test_valid_yaml(self):
        out = _render_yaml([], [], None, [])
        assert "intentfoundry_context" in out

    def test_contains_specs(self):
        spec = _make_spec()
        out = _render_yaml([spec], [], None, [])
        assert "specs" in out

    def test_contains_adrs(self):
        adr = _make_adr()
        out = _render_yaml([], [adr], None, [])
        assert "adrs" in out

    def test_contains_bounded_context(self):
        ctx = _make_context()
        out = _render_yaml([], [], ctx, [])
        assert "Auth" in out
