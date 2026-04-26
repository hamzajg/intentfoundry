"""
Integration tests — full HTTP cycle through all four core capabilities.
Each test uses the real FastAPI app with an in-memory SQLite database.
"""
import pytest
from httpx import AsyncClient


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TestAuth:
    async def test_register(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/auth/register",
            json={"email": "new@if.dev", "password": "password123"},
        )
        assert r.status_code == 201
        assert r.json()["email"] == "new@if.dev"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user: dict):
        r = await client.post(
            "/api/v1/auth/register",
            json={"email": test_user["email"], "password": "password123"},
        )
        assert r.status_code == 409

    async def test_login(self, client: AsyncClient, test_user: dict):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": test_user["email"], "password": test_user["password"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user: dict):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": test_user["email"], "password": "wrongpassword"},
        )
        assert r.status_code == 401

    async def test_get_me(self, client: AsyncClient, auth_headers: dict, test_user: dict):
        r = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == test_user["email"]

    async def test_create_and_use_api_key(self, client: AsyncClient, auth_headers: dict):
        # Create key
        r = await client.post(
            "/api/v1/auth/api-keys",
            json={"name": "CI key"},
            headers=auth_headers,
        )
        assert r.status_code == 201
        key_data = r.json()
        assert "key" in key_data
        assert key_data["key"].startswith("if_")

        # Use key to authenticate
        r2 = await client.get(
            "/api/v1/auth/me",
            headers={"X-API-Key": key_data["key"]},
        )
        assert r2.status_code == 200

    async def test_unauthenticated_request(self, client: AsyncClient):
        r = await client.get("/api/v1/projects")
        assert r.status_code == 401


# ─── Projects ─────────────────────────────────────────────────────────────────

class TestProjects:
    async def test_create_project(self, client: AsyncClient, auth_headers: dict):
        r = await client.post(
            "/api/v1/projects",
            json={"name": "My Project", "slug": "my-project", "domain": "software"},
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["slug"] == "my-project"
        assert data["domain"] == "software"

    async def test_duplicate_slug_rejected(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        r = await client.post(
            "/api/v1/projects",
            json={"name": "Dupe", "slug": test_project["slug"]},
            headers=auth_headers,
        )
        assert r.status_code == 409

    async def test_list_projects(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        r = await client.get("/api/v1/projects", headers=auth_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert test_project["id"] in ids

    async def test_update_project(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        r = await client.patch(
            f"/api/v1/projects/{test_project['id']}",
            json={"description": "Updated description"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["description"] == "Updated description"

    async def test_delete_project(self, client: AsyncClient, auth_headers: dict):
        # Create a project to delete
        r = await client.post(
            "/api/v1/projects",
            json={"name": "To Delete", "slug": "to-delete"},
            headers=auth_headers,
        )
        pid = r.json()["id"]
        r2 = await client.delete(f"/api/v1/projects/{pid}", headers=auth_headers)
        assert r2.status_code == 204
        # Should 404 after deletion
        r3 = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
        assert r3.status_code == 404


# ─── Intent module ────────────────────────────────────────────────────────────

class TestIntent:
    async def test_create_bdd_spec(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/specs",
            json={
                "title": "User Login",
                "slug": "user-login",
                "format": "bdd",
                "content": {
                    "bdd_scenarios": [
                        {
                            "title": "Successful login",
                            "given": ["a registered user with a verified email"],
                            "when": ["they submit valid credentials"],
                            "then": ["they receive a JWT access token"],
                        }
                    ],
                    "acceptance_criteria": ["Token expires in 24 hours"],
                },
                "change_summary": "Initial spec",
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["format"] == "bdd"
        assert data["current_version"] == 1

    async def test_spec_versioning(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        # Create spec
        r = await client.post(
            f"/api/v1/projects/{pid}/specs",
            json={
                "title": "Versioned Spec",
                "slug": "versioned-spec",
                "format": "free",
                "content": {"free_text": "Version 1 content"},
            },
            headers=auth_headers,
        )
        spec_id = r.json()["id"]

        # Update content — should bump version
        r2 = await client.patch(
            f"/api/v1/projects/{pid}/specs/{spec_id}",
            json={
                "content": {"free_text": "Version 2 content"},
                "change_summary": "Updated requirements",
            },
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["current_version"] == 2

        # Check version history
        r3 = await client.get(
            f"/api/v1/projects/{pid}/specs/{spec_id}/versions",
            headers=auth_headers,
        )
        assert r3.status_code == 200
        versions = r3.json()
        assert len(versions) == 2
        assert versions[0]["version_number"] == 2  # newest first

    async def test_spec_slug_uniqueness(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        payload = {
            "title": "Duplicate Slug",
            "slug": "duplicate-slug",
            "format": "free",
            "content": {"free_text": "content"},
        }
        r1 = await client.post(
            f"/api/v1/projects/{pid}/specs", json=payload, headers=auth_headers
        )
        assert r1.status_code == 201
        r2 = await client.post(
            f"/api/v1/projects/{pid}/specs", json=payload, headers=auth_headers
        )
        assert r2.status_code == 409

    async def test_list_specs_with_filters(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        # Create two specs with different formats
        for fmt, slug in [("bdd", "bdd-spec"), ("cdc", "cdc-spec")]:
            await client.post(
                f"/api/v1/projects/{pid}/specs",
                json={
                    "title": f"{fmt} spec",
                    "slug": slug,
                    "format": fmt,
                    "content": {"free_text": "content"},
                },
                headers=auth_headers,
            )

        r = await client.get(
            f"/api/v1/projects/{pid}/specs?format=bdd",
            headers=auth_headers,
        )
        assert r.status_code == 200
        items = r.json()["items"]
        assert all(s["format"] == "bdd" for s in items)


# ─── Architecture module ──────────────────────────────────────────────────────

class TestArchitecture:
    async def test_create_adr(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/adrs",
            json={
                "title": "Use event-driven communication between services",
                "context": "We need to decouple services to allow independent scaling.",
                "decision": "All inter-service communication uses async events via a message bus.",
                "consequences": "Services are decoupled. Eventual consistency must be handled.",
                "alternatives_considered": "REST API calls — rejected due to tight coupling.",
                "tags": ["architecture", "messaging"],
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["number"] == 1
        assert data["status"] == "proposed"

    async def test_adr_auto_numbering(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        base = {
            "context": "ctx",
            "decision": "dec",
            "consequences": "cons",
        }
        r1 = await client.post(
            f"/api/v1/projects/{pid}/adrs",
            json={"title": "ADR One", **base},
            headers=auth_headers,
        )
        r2 = await client.post(
            f"/api/v1/projects/{pid}/adrs",
            json={"title": "ADR Two", **base},
            headers=auth_headers,
        )
        assert r1.json()["number"] == 1
        assert r2.json()["number"] == 2

    async def test_adr_status_transition(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/adrs",
            json={
                "title": "Status test ADR",
                "context": "ctx",
                "decision": "dec",
                "consequences": "cons",
            },
            headers=auth_headers,
        )
        adr_id = r.json()["id"]
        r2 = await client.patch(
            f"/api/v1/projects/{pid}/adrs/{adr_id}",
            json={"status": "accepted"},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "accepted"

    async def test_create_fitness_function(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/fitness",
            json={
                "name": "No direct DB imports",
                "description": "Services must not import db models directly",
                "severity": "error",
                "check_type": "regex",
                "check_config": {
                    "pattern": "from app.models",
                    "file_glob": "app/api/**/*.py",
                    "should_match": False,
                },
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["check_type"] == "regex"
        assert data["severity"] == "error"

    async def test_run_fitness_functions(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        # Create a simple always-passing check
        await client.post(
            f"/api/v1/projects/{pid}/fitness",
            json={
                "name": "Always pass",
                "severity": "info",
                "check_type": "custom_script",
                "check_config": {"script": "exit 0", "script_language": "bash"},
            },
            headers=auth_headers,
        )
        r = await client.post(
            f"/api/v1/projects/{pid}/fitness/run",
            json={"triggered_by": "test"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert data["passed"] + data["failed"] + data["errors"] + data["skipped"] == len(
            data["results"]
        )

    async def test_create_bounded_context(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/contexts",
            json={
                "name": "Auth Service",
                "description": "Handles all authentication and authorisation",
                "includes": "Login, logout, token refresh, API keys",
                "excludes": "User profile management, billing",
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        assert r.json()["name"] == "Auth Service"

    async def test_ai_context_builder(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        # Create a spec to include in context
        sr = await client.post(
            f"/api/v1/projects/{pid}/specs",
            json={
                "title": "Context Test Spec",
                "slug": "context-test-spec",
                "format": "free",
                "content": {"free_text": "Build a login endpoint"},
            },
            headers=auth_headers,
        )
        spec_id = sr.json()["id"]

        r = await client.post(
            f"/api/v1/projects/{pid}/ai-context",
            json={
                "spec_ids": [spec_id],
                "format": "markdown",
                "include_fitness_constraints": True,
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "context_package" in data
        assert "IntentFoundry Context Package" in data["context_package"]
        assert data["spec_count"] == 1
        assert data["token_estimate"] > 0


# ─── Loop module ──────────────────────────────────────────────────────────────

class TestLoop:
    async def test_create_sprint(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.post(
            f"/api/v1/projects/{pid}/sprints",
            json={
                "name": "Sprint 1",
                "goal": "Implement user authentication",
                "spec_ids": [],
                "active_adr_ids": [],
            },
            headers=auth_headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["current_stage"] == "define"
        assert data["status"] == "active"

    async def test_sprint_auto_creates_checkpoint(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        sr = await client.post(
            f"/api/v1/projects/{pid}/sprints",
            json={"name": "Sprint checkpoint test"},
            headers=auth_headers,
        )
        sprint_id = sr.json()["id"]
        r = await client.get(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/checkpoints",
            headers=auth_headers,
        )
        assert r.status_code == 200
        checkpoints = r.json()
        assert len(checkpoints) == 1
        assert checkpoints[0]["stage"] == "define"
        assert checkpoints[0]["is_required"] is True
        assert checkpoints[0]["status"] == "pending"

    async def test_advance_stage_blocked_by_pending_checkpoint(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        sr = await client.post(
            f"/api/v1/projects/{pid}/sprints",
            json={"name": "Blocked sprint"},
            headers=auth_headers,
        )
        sprint_id = sr.json()["id"]
        # Try to advance without resolving checkpoint
        r = await client.post(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/advance",
            json={},
            headers=auth_headers,
        )
        assert r.status_code == 409
        assert "pending_checkpoints" in r.json()["detail"]

    async def test_full_sprint_lifecycle(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        sr = await client.post(
            f"/api/v1/projects/{pid}/sprints",
            json={"name": "Full lifecycle sprint"},
            headers=auth_headers,
        )
        sprint_id = sr.json()["id"]

        # Get and resolve the define checkpoint
        cpr = await client.get(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/checkpoints",
            headers=auth_headers,
        )
        cp_id = cpr.json()[0]["id"]
        await client.post(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/checkpoints/{cp_id}/resolve",
            json={"status": "approved", "resolution_notes": "Specs look good"},
            headers=auth_headers,
        )

        # Advance through all stages: DEFINE→GENERATE→VALIDATE→SHIP→REFLECT, then REFLECT→COMPLETED
        stages_to_advance_to = ["generate", "validate", "ship", "reflect"]
        for expected_stage in stages_to_advance_to:
            r = await client.post(
                f"/api/v1/projects/{pid}/sprints/{sprint_id}/advance",
                json={},
                headers=auth_headers,
            )
            assert r.status_code == 200
            assert r.json()["current_stage"] == expected_stage

            # Resolve the new auto-created checkpoint if present
            cpr2 = await client.get(
                f"/api/v1/projects/{pid}/sprints/{sprint_id}/checkpoints",
                headers=auth_headers,
            )
            for cp in cpr2.json():
                if cp["status"] == "pending":
                    await client.post(
                        f"/api/v1/projects/{pid}/sprints/{sprint_id}/checkpoints/{cp['id']}/resolve",
                        json={"status": "approved"},
                        headers=auth_headers,
                    )

        # Final advance from REFLECT → completes the sprint
        r_complete = await client.post(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/advance",
            json={},
            headers=auth_headers,
        )
        assert r_complete.status_code == 200
        assert r_complete.json()["status"] == "completed"

    async def test_force_advance_requires_reason(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        sr = await client.post(
            f"/api/v1/projects/{pid}/sprints",
            json={"name": "Force test sprint"},
            headers=auth_headers,
        )
        sprint_id = sr.json()["id"]
        # Force without reason
        r = await client.post(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/advance",
            json={"force": True},
            headers=auth_headers,
        )
        assert r.status_code == 422
        # Force with reason
        r2 = await client.post(
            f"/api/v1/projects/{pid}/sprints/{sprint_id}/advance",
            json={"force": True, "force_reason": "Emergency hotfix — deadline today"},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["current_stage"] == "generate"


# ─── Telemetry module ─────────────────────────────────────────────────────────

class TestTelemetry:
    async def test_events_emitted_on_spec_create(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        await client.post(
            f"/api/v1/projects/{pid}/specs",
            json={
                "title": "Telemetry test spec",
                "slug": "telemetry-test-spec",
                "format": "free",
                "content": {"free_text": "content"},
            },
            headers=auth_headers,
        )
        r = await client.get(
            f"/api/v1/projects/{pid}/telemetry/events?event_type=spec.created",
            headers=auth_headers,
        )
        assert r.status_code == 200
        events = r.json()
        assert any(e["event_type"] == "spec.created" for e in events)

    async def test_project_health_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_project: dict
    ):
        pid = test_project["id"]
        r = await client.get(
            f"/api/v1/projects/{pid}/telemetry/health",
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "total_sprints" in data
        assert "reflect_stage_completion_rate" in data
        assert "recent_fitness_pass_rate" in data

    async def test_health_endpoint(self, client: AsyncClient):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] in ("healthy", "degraded")
