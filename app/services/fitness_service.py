"""
Fitness service — executes fitness function checks against project output.

Each check_type has a dedicated executor. The service runs them concurrently,
collects results, persists them, and updates the cached last_result on the
FitnessFunction model.

Supported check types:
  - regex          : pattern match / no-match against files
  - dependency_limit : counts imports/dependencies against a limit
  - custom_script  : runs an inline Python or bash script
  - api_check      : calls an external endpoint (CI webhook integration)
  - ast_rule       : reserved for Phase 2 (AST analysis)
"""
import asyncio
import re
import subprocess
import time
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.domain import (
    FitnessFunction,
    FitnessFunctionResult,
    FitnessResult,
    FitnessSeverity,
)
from app.schemas.schemas import FitnessRunResponse, FitnessRunResult

settings = get_settings()


class FitnessService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def run(
        self,
        project_id: str,
        function_ids: list[str] | None,
        sprint_id: str | None,
        triggered_by: str = "api",
    ) -> FitnessRunResponse:
        """
        Execute one or more fitness functions concurrently.
        If function_ids is None, runs all active functions for the project.
        """
        query = select(FitnessFunction).where(
            FitnessFunction.project_id == project_id,
            FitnessFunction.deleted_at.is_(None),
            FitnessFunction.is_active.is_(True),
        )
        if function_ids:
            query = query.where(FitnessFunction.id.in_(function_ids))

        result = await self.db.execute(query)
        functions = result.scalars().all()

        if not functions:
            return FitnessRunResponse(
                project_id=project_id,
                sprint_id=sprint_id,
                results=[],
                passed=0,
                failed=0,
                errors=0,
                skipped=0,
                run_at=datetime.now(UTC),
            )

        # Run all checks concurrently with timeout protection
        tasks = [
            self._execute_with_timeout(fn, sprint_id, triggered_by)
            for fn in functions
        ]
        results: list[FitnessRunResult] = await asyncio.gather(*tasks)

        # Persist results and update cached last_result
        for fn, run_result in zip(functions, results):
            fn.last_result = run_result.result.value
            fn.last_run_at = datetime.now(UTC)

            db_result = FitnessFunctionResult(
                function_id=fn.id,
                sprint_id=sprint_id,
                result=run_result.result,
                message=run_result.message,
                details={**run_result.details, "duration_ms": run_result.duration_ms},
                triggered_by=triggered_by,
            )
            self.db.add(db_result)

        await self.db.flush()

        return FitnessRunResponse(
            project_id=project_id,
            sprint_id=sprint_id,
            results=results,
            passed=sum(1 for r in results if r.result == FitnessResult.PASS),
            failed=sum(1 for r in results if r.result == FitnessResult.FAIL),
            errors=sum(1 for r in results if r.result == FitnessResult.ERROR),
            skipped=sum(1 for r in results if r.result == FitnessResult.SKIPPED),
            run_at=datetime.now(UTC),
        )

    async def _execute_with_timeout(
        self,
        fn: FitnessFunction,
        sprint_id: str | None,
        triggered_by: str,
    ) -> FitnessRunResult:
        timeout = fn.check_config.get("timeout_seconds", settings.fitness_check_timeout_seconds)
        try:
            return await asyncio.wait_for(
                self._execute(fn),
                timeout=float(timeout),
            )
        except asyncio.TimeoutError:
            return FitnessRunResult(
                function_id=fn.id,
                function_name=fn.name,
                result=FitnessResult.ERROR,
                severity=fn.severity,
                message=f"Check timed out after {timeout}s",
                details={"timeout_seconds": timeout},
                duration_ms=timeout * 1000,
            )

    async def _execute(self, fn: FitnessFunction) -> FitnessRunResult:
        start = time.monotonic()
        cfg = fn.check_config

        try:
            match fn.check_type:
                case "regex":
                    result, message, details = await _run_regex_check(cfg)
                case "dependency_limit":
                    result, message, details = await _run_dependency_check(cfg)
                case "custom_script":
                    result, message, details = await _run_script_check(cfg)
                case "api_check":
                    result, message, details = await _run_api_check(cfg)
                case "ast_rule":
                    result = FitnessResult.SKIPPED
                    message = "AST rule checks are available in Phase 2"
                    details = {}
                case _:
                    result = FitnessResult.ERROR
                    message = f"Unknown check_type: {fn.check_type}"
                    details = {}
        except Exception as exc:
            result = FitnessResult.ERROR
            message = f"Unexpected error: {exc!s}"
            details = {"exception": type(exc).__name__}

        duration_ms = int((time.monotonic() - start) * 1000)
        return FitnessRunResult(
            function_id=fn.id,
            function_name=fn.name,
            result=result,
            severity=fn.severity,
            message=message,
            details=details,
            duration_ms=duration_ms,
        )


# ─── Check executors ─────────────────────────────────────────────────────────

async def _run_regex_check(
    cfg: dict[str, Any],
) -> tuple[FitnessResult, str, dict]:
    """
    Check that files matching a glob either DO or DO NOT contain a pattern.

    config keys:
      pattern      : regex string
      file_glob    : glob pattern (e.g. "**/*.py")
      should_match : True = files MUST match, False = files MUST NOT match
    """
    import glob as glob_module

    pattern = cfg.get("pattern", "")
    file_glob = cfg.get("file_glob", "**/*")
    should_match = cfg.get("should_match", False)

    if not pattern:
        return FitnessResult.ERROR, "No pattern configured", {}

    try:
        compiled = re.compile(pattern)
    except re.error as e:
        return FitnessResult.ERROR, f"Invalid regex: {e}", {}

    violations: list[str] = []
    files_checked = 0

    # In a real project, this would scan the project's repository.
    # In prototype mode we scan the local working directory.
    for filepath in glob_module.glob(file_glob, recursive=True):
        try:
            with open(filepath, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            files_checked += 1
            matched = bool(compiled.search(content))
            if should_match and not matched:
                violations.append(f"{filepath}: expected pattern not found")
            elif not should_match and matched:
                violations.append(f"{filepath}: forbidden pattern found")
        except OSError:
            continue

    if violations:
        return (
            FitnessResult.FAIL,
            f"{len(violations)} file(s) violated the constraint",
            {"violations": violations[:20], "files_checked": files_checked},
        )
    return (
        FitnessResult.PASS,
        f"All {files_checked} file(s) passed",
        {"files_checked": files_checked},
    )


async def _run_dependency_check(
    cfg: dict[str, Any],
) -> tuple[FitnessResult, str, dict]:
    """
    Verify that no module exceeds a dependency count limit.

    config keys:
      max_dependencies : int — maximum allowed imports
      scope            : 'module' | 'package'
      file_glob        : which files to check (default: **/*.py)
    """
    import ast
    import glob as glob_module

    max_deps = cfg.get("max_dependencies", 10)
    file_glob = cfg.get("file_glob", "**/*.py")
    violations: list[dict] = []

    for filepath in glob_module.glob(file_glob, recursive=True):
        try:
            with open(filepath, encoding="utf-8", errors="ignore") as f:
                source = f.read()
            tree = ast.parse(source, filename=filepath)
            import_count = sum(
                1 for node in ast.walk(tree)
                if isinstance(node, (ast.Import, ast.ImportFrom))
            )
            if import_count > max_deps:
                violations.append({
                    "file": filepath,
                    "import_count": import_count,
                    "limit": max_deps,
                })
        except (OSError, SyntaxError):
            continue

    if violations:
        return (
            FitnessResult.FAIL,
            f"{len(violations)} module(s) exceed the dependency limit of {max_deps}",
            {"violations": violations[:20]},
        )
    return FitnessResult.PASS, f"All modules within limit of {max_deps} dependencies", {}


async def _run_script_check(
    cfg: dict[str, Any],
) -> tuple[FitnessResult, str, dict]:
    """
    Execute a custom inline script. Exit code 0 = PASS, non-zero = FAIL.

    config keys:
      script          : script body (string)
      script_language : 'python' | 'bash'

    Security note: in production, scripts run in a sandboxed subprocess
    with no network access and a hard CPU/memory limit. For the prototype,
    scripts run in a restricted subprocess.
    """
    script = cfg.get("script", "")
    language = cfg.get("script_language", "bash")

    if not script:
        return FitnessResult.ERROR, "No script configured", {}

    try:
        if language == "python":
            cmd = ["python", "-c", script]
        else:
            cmd = ["bash", "-c", script]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=25.0)
        exit_code = proc.returncode

        result = FitnessResult.PASS if exit_code == 0 else FitnessResult.FAIL
        return (
            result,
            stdout.decode()[:500] or stderr.decode()[:500] or f"Exit code: {exit_code}",
            {
                "exit_code": exit_code,
                "stdout": stdout.decode()[:200],
                "stderr": stderr.decode()[:200],
            },
        )
    except asyncio.TimeoutError:
        return FitnessResult.ERROR, "Script timed out", {}
    except Exception as exc:
        return FitnessResult.ERROR, f"Script execution failed: {exc}", {}


async def _run_api_check(
    cfg: dict[str, Any],
) -> tuple[FitnessResult, str, dict]:
    """
    Call an external API endpoint and check the response status.
    Used for CI webhook integration — e.g. triggering an external test suite.

    config keys:
      endpoint        : URL to call
      expected_status : expected HTTP status code (default: 200)
      payload_schema  : optional JSON payload to POST
    """
    endpoint = cfg.get("endpoint", "")
    expected_status = cfg.get("expected_status", 200)
    payload = cfg.get("payload_schema")

    if not endpoint:
        return FitnessResult.ERROR, "No endpoint configured", {}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            if payload:
                response = await client.post(endpoint, json=payload)
            else:
                response = await client.get(endpoint)

        if response.status_code == expected_status:
            return (
                FitnessResult.PASS,
                f"API responded with expected status {expected_status}",
                {"status_code": response.status_code, "endpoint": endpoint},
            )
        return (
            FitnessResult.FAIL,
            f"Expected status {expected_status}, got {response.status_code}",
            {
                "expected": expected_status,
                "actual": response.status_code,
                "endpoint": endpoint,
            },
        )
    except httpx.RequestError as exc:
        return FitnessResult.ERROR, f"API request failed: {exc}", {"endpoint": endpoint}
