"""Unit tests for pure logic — no database, no HTTP."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.auth_service import hash_password, verify_password, generate_api_key
from app.services.telemetry_service import _compute_health_score
from app.services.context_service import _render_markdown


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("supersecret")
        assert verify_password("supersecret", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("supersecret")
        assert not verify_password("wrongpassword", hashed)

    def test_same_password_different_hashes(self):
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2  # bcrypt salting


class TestAPIKeyGeneration:
    def test_key_starts_with_prefix(self):
        full_key, prefix, key_hash = generate_api_key()
        assert full_key.startswith("if_")

    def test_prefix_is_first_12_chars(self):
        full_key, prefix, key_hash = generate_api_key()
        assert prefix == full_key[:12]

    def test_hash_is_deterministic(self):
        from app.services.auth_service import hash_api_key
        key = "if_testkey123"
        assert hash_api_key(key) == hash_api_key(key)

    def test_different_keys_different_hashes(self):
        from app.services.auth_service import hash_api_key
        k1, _, _ = generate_api_key()
        k2, _, _ = generate_api_key()
        assert hash_api_key(k1) != hash_api_key(k2)


class TestHealthScore:
    def test_perfect_sprint(self):
        score = _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        )
        assert score == 100

    def test_no_reflect_penalised(self):
        score = _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=0,
            reflect_stage_completed=False,
        )
        assert score == 80

    def test_rework_penalised(self):
        score = _compute_health_score(
            spec_rework_count=3,
            architecture_drift_count=0,
            reflect_stage_completed=True,
        )
        assert score == 85  # 100 - 15

    def test_drift_penalised_more(self):
        score = _compute_health_score(
            spec_rework_count=0,
            architecture_drift_count=2,
            reflect_stage_completed=True,
        )
        assert score == 80  # 100 - 20

    def test_score_never_negative(self):
        # Max penalties: rework cap=30, drift cap=40, no-reflect=20 → 100-90=10
        score = _compute_health_score(
            spec_rework_count=100,
            architecture_drift_count=100,
            reflect_stage_completed=False,
        )
        assert score == 10  # 100 - 30 (capped) - 40 (capped) - 20 = 10

    def test_total_wipeout(self):
        # Only possible if we don't cap: with reflect missing + 8 drifts + 6 reworks
        # 6*5=30 (capped), 4*10=40 (capped), no-reflect=20 → 100-90=10
        # Can't reach 0 with current caps — verify floor stays 0 with inflated numbers
        score = _compute_health_score(
            spec_rework_count=1000,
            architecture_drift_count=1000,
            reflect_stage_completed=False,
        )
        assert score >= 0  # Always non-negative

    def test_rework_cap(self):
        # Penalty for rework is capped at 30
        score_6 = _compute_health_score(6, 0, True)
        score_100 = _compute_health_score(100, 0, True)
        assert score_6 == score_100  # Both hit the cap


class TestContextRenderer:
    """Test the context builder's markdown output."""

    def test_renders_header(self):
        output = _render_markdown([], [], None, [])
        assert "IntentFoundry Context Package" in output

    def test_renders_fitness_constraints(self):
        constraints = ["[ERROR] No direct DB imports: Services must not import db"]
        output = _render_markdown([], [], None, constraints)
        assert "Architectural Constraints" in output
        assert "[ERROR]" in output

    def test_renders_bounded_context(self):
        bc = MagicMock()
        bc.name = "Auth Service"
        bc.description = "Handles auth"
        bc.includes = "Login, logout"
        bc.excludes = "User profiles"
        bc.interfaces = {}
        output = _render_markdown([], [], bc, [])
        assert "Auth Service" in output
        assert "Login, logout" in output
        assert "User profiles" in output

    def test_free_text_spec_rendered(self):
        spec = MagicMock()
        spec.title = "My Spec"
        spec.format = MagicMock()
        spec.format.value = "free"
        spec.content = {
            "free_text": "Build a login endpoint that returns JWT",
            "acceptance_criteria": ["Token expires in 24h"],
            "out_of_scope": ["Password reset"],
        }
        output = _render_markdown([spec], [], None, [])
        assert "My Spec" in output
        assert "Build a login endpoint" in output
        assert "Token expires in 24h" in output
        assert "Password reset" in output
