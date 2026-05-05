"""
Unit tests for FitnessService check executors — pure logic, no database.
Tests the private async functions that execute individual check types.
"""
import asyncio
import os
import tempfile

import pytest

from app.services.fitness_service import (
    _run_regex_check,
    _run_dependency_check,
    _run_script_check,
)
from app.models.domain import FitnessResult


# ─── Regex Check ─────────────────────────────────────────────────────────────

@pytest.fixture
def temp_project(tmp_path):
    """Create a temporary directory with sample Python files."""
    (tmp_path / "app" / "models").mkdir(parents=True)
    (tmp_path / "app" / "api").mkdir(parents=True)

    (tmp_path / "app" / "models" / "user.py").write_text(
        "from app.db import Session\n\nclass User:\n    pass\n"
    )
    (tmp_path / "app" / "api" / "routes.py").write_text(
        "from fastapi import APIRouter\n\nrouter = APIRouter()\n"
    )
    (tmp_path / "clean.py").write_text(
        "import os\n\ndef main():\n    pass\n"
    )
    return tmp_path


class TestRunRegexCheck:
    @pytest.mark.asyncio
    async def test_forbidden_pattern_found(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_regex_check({
            "pattern": r"from app\.db",
            "file_glob": "**/*.py",
            "should_match": False,
        })
        assert result == FitnessResult.FAIL
        assert details["files_checked"] >= 1

    @pytest.mark.asyncio
    async def test_forbidden_pattern_not_found(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_regex_check({
            "pattern": r"from app\.db",
            "file_glob": "app/api/*.py",
            "should_match": False,
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_required_pattern_found(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_regex_check({
            "pattern": r"from fastapi",
            "file_glob": "app/api/*.py",
            "should_match": True,
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_required_pattern_not_found(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_regex_check({
            "pattern": r"from sqlalchemy",
            "file_glob": "app/api/*.py",
            "should_match": True,
        })
        assert result == FitnessResult.FAIL

    @pytest.mark.asyncio
    async def test_no_pattern_configured(self):
        result, message, details = await _run_regex_check({
            "pattern": "",
            "file_glob": "**/*.py",
            "should_match": False,
        })
        assert result == FitnessResult.ERROR
        assert "No pattern" in message

    @pytest.mark.asyncio
    async def test_invalid_regex(self):
        result, message, details = await _run_regex_check({
            "pattern": r"[invalid",
            "file_glob": "**/*.py",
            "should_match": False,
        })
        assert result == FitnessResult.ERROR
        assert "Invalid regex" in message

    @pytest.mark.asyncio
    async def test_default_should_match_is_false(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_regex_check({
            "pattern": r"import os",
            "file_glob": "*.py",
        })
        assert result == FitnessResult.FAIL


# ─── Dependency Limit Check ──────────────────────────────────────────────────

class TestRunDependencyCheck:
    @pytest.mark.asyncio
    async def test_within_limit(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_dependency_check({
            "max_dependencies": 100,
            "file_glob": "**/*.py",
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_exceeds_limit(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_dependency_check({
            "max_dependencies": 0,
            "file_glob": "**/*.py",
        })
        assert result == FitnessResult.FAIL

    @pytest.mark.asyncio
    async def test_no_files_match_glob(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_dependency_check({
            "max_dependencies": 5,
            "file_glob": "**/*.ts",
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_default_max_deps(self, temp_project):
        os.chdir(temp_project)
        result, message, details = await _run_dependency_check({
            "file_glob": "**/*.py",
        })
        assert result == FitnessResult.PASS


# ─── Script Check ────────────────────────────────────────────────────────────

class TestRunScriptCheck:
    @pytest.mark.asyncio
    async def test_passing_bash_script(self):
        result, message, details = await _run_script_check({
            "script": "exit 0",
            "script_language": "bash",
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_failing_bash_script(self):
        result, message, details = await _run_script_check({
            "script": "exit 1",
            "script_language": "bash",
        })
        assert result == FitnessResult.FAIL
        assert details["exit_code"] == 1

    @pytest.mark.asyncio
    async def test_passing_python_script(self):
        result, message, details = await _run_script_check({
            "script": "print('hello')",
            "script_language": "python",
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_failing_python_script(self):
        result, message, details = await _run_script_check({
            "script": "raise RuntimeError('fail')",
            "script_language": "python",
        })
        assert result == FitnessResult.FAIL

    @pytest.mark.asyncio
    async def test_no_script_configured(self):
        result, message, details = await _run_script_check({
            "script": "",
            "script_language": "bash",
        })
        assert result == FitnessResult.ERROR
        assert "No script" in message

    @pytest.mark.asyncio
    async def test_default_language_is_bash(self):
        result, message, details = await _run_script_check({
            "script": "exit 0",
        })
        assert result == FitnessResult.PASS

    @pytest.mark.asyncio
    async def test_script_output_captured(self):
        result, message, details = await _run_script_check({
            "script": "echo 'success output'",
            "script_language": "bash",
        })
        assert result == FitnessResult.PASS
        assert details.get("stdout") == "success output\n"
