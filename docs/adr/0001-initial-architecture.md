# ADR 0001 — Initial architecture

Date: 2026-11-13 (baseline recorded retroactively)
Status: accepted (describes what is built)

## Context

IntentFoundry positions itself between human intent and AI execution. The
core claim: agents must build *within* human-defined constraints rather than
invent around them. The architecture must make that enforceable, not
aspirational.

## Decisions

1. **Spec-driven domain model.** Intent (BDD/CDC/examples), ADRs, and
   fitness functions are first-class persisted entities — not docs
   bolted on. Rationale: constraints must be machine-checkable to bind
   agents.
2. **Five-stage collaboration loop with enforced checkpoints.** Define →
   Generate → Validate → Ship → Reflect; humans decide at gates. Rationale:
   keeps humans in the loop structurally, not by convention.
3. **Fitness functions run in CI.** Architecture rules are executable
   checks (`fitness_service`), so drift fails builds. Rationale: ADRs that
   aren't enforced decay into wallpaper.
4. **SQLite by default, Postgres optional.** `sqlite+aiosqlite` dev DB means
   `pip install -e ".[dev]"` + `uvicorn` is a complete setup. Rationale:
   adoption friction is the enemy of a framework.
5. **Redis optional, only for SSE telemetry.** Real-time loop visibility
   degrades gracefully to polling without it. Rationale: KISS — don't make
   a cache/queue a hard dependency for core features.
6. **FastAPI + React SPA, single deployable.** Backend serves the built
   frontend from `app/static/`; dev uses Vite proxy. Rationale: one process,
   one port, one auth boundary.
7. **Axios client module as the only FE→BE path.** `frontend/src/api/client.ts`
   centralises base URL, Bearer injection, offline queue. Rationale: DRY +
   one place for auth/error policy.

## Consequences

- The product only works if teams actually write specs — tooling can't
  create intent.
- Fitness functions need maintenance as the architecture evolves; stale
  checks are worse than none.
- Optional Redis means telemetry semantics differ slightly between modes;
  documented rather than unified.
