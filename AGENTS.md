# AGENTS.md — intentfoundry

Guidance for AI agents (and humans) working in this repository.

## Project

IntentFoundry is an open-source human-AI collaboration framework: versioned
BDD/CDC/example-driven intent specs, architecture governance (ADRs +
fitness functions), a five-stage collaboration loop (Define → Generate →
Validate → Ship → Reflect) with human decision checkpoints, and loop
telemetry. Full-stack: FastAPI backend + React/Vite frontend.
Stack: Python ≥3.13 (FastAPI, SQLAlchemy/Alembic, aiosqlite/SQLite default,
Postgres optional, Redis optional for SSE), React 18 + Vite + Tailwind +
TanStack Query + xyflow.

## Commands

Verified 2026-11-13 against CI (`.github/workflows/ci.yml`).

| Task | Command |
|---|---|
| Install (backend) | `pip install -e ".[dev]"` |
| Configure | `cp .env.example .env` (defaults work) |
| Run (backend) | `uvicorn app.main:app --reload --port 8000` |
| API docs | http://localhost:8000/docs |
| Test (backend) | `pytest --cov=app` (248 tests) |
| Install (frontend) | `cd frontend && npm ci` |
| Dev (frontend) | `cd frontend && npm run dev` |
| Test (frontend) | `cd frontend && npm test` (vitest) |
| Build (frontend) | `cd frontend && npm run build` (`tsc && vite build`) |
| Docker (all) | `docker compose up` (Postgres + Redis) |

Requires: Python ≥3.13; SQLite works zero-config
(`sqlite+aiosqlite:///./intentfoundry_dev.db`), Postgres/Redis optional.

## Architecture

- `app/main.py` — FastAPI entrypoint.
- `app/api/v1/` — router + `endpoints/`: `auth`, `projects`, `intent`,
  `architecture`, `loop`, `canvas`, `telemetry`. `deps.py` = auth/deps.
- `app/modules/` — domain modules: `intent`, `architecture`, `loop`,
  `telemetry` (business logic lives here, not in endpoints).
- `app/models/` + `app/db/` — SQLAlchemy models, `database.py` session;
  `alembic/` migrations.
- `app/schemas/schemas.py` — pydantic request/response models.
- `app/services/` — `auth_service` (JWT/API-key), `context_service`,
  `fitness_service` (architecture fitness functions), `telemetry_service`.
- `app/static/` — built frontend assets served by FastAPI.
- `frontend/src/` — React app: `api/client.ts` (axios instance, Bearer
  interceptor, offline retry queue), `api/canvasApi.ts`, `pages/`
  (Landing, Auth, Projects, Intent, Architecture, Loop, Canvas,
  Telemetry, Overview, Settings), `stores/` (auth store), `hooks/`.

### API contract (frontend ↔ backend)

All endpoints under `/api/v1/`; auth via `Authorization: Bearer <JWT>` or
`X-API-Key`. Frontend base URL: `VITE_API_URL` or `/api/v1` (proxied in
dev). Endpoint modules map 1:1 to `app/api/v1/endpoints/*.py` — keep
paths/payloads in sync; `frontend/src/api/` is the only place frontend
code should call the API.

| Area | Endpoints (module) |
|---|---|
| Auth | `/auth/*` (`endpoints/auth.py`) — JWT + API keys |
| Projects | `/projects/*` (`endpoints/projects.py`) |
| Intent specs | `/projects/{id}/intent*` (`endpoints/intent.py`) |
| Architecture/ADRs | `/projects/{id}/architecture*`, fitness (`endpoints/architecture.py`) |
| Loop | `/projects/{id}/loop*` (`endpoints/loop.py`) |
| Canvas | `/projects/{id}/canvas` GET/POST/DELETE (`endpoints/canvas.py`) |
| Telemetry | `/projects/{id}/telemetry*` + SSE (`endpoints/telemetry.py`) |

## Conventions

- Endpoints stay thin: parse via `app/schemas/`, delegate to
  `app/modules/` + `app/services/`. Business rules don't live in routers.
- Specs/ADRs/loop state are the product's core data — versioning and
  immutability of published intent matter; check `app/modules/intent`
  before changing shapes.
- Frontend: all HTTP through `frontend/src/api/client.ts` axios instance;
  pages use TanStack Query hooks. Don't fetch ad-hoc in components.
- KISS/SOLID/DRY: simplest change matching existing patterns; no new
  frameworks.

## Landmines

- `requires-python = ">=3.13"` — don't test on older interpreters.
- `intentfoundry_dev.db` is a committed/local SQLite file — don't commit
  churn to it; `.env` holds local overrides.
- Telemetry SSE needs Redis only when `redis_enabled`; without it the API
  still works (polling/degraded mode).
- Frontend has both `package-lock.json` and `bun.lock` — CI uses npm;
  prefer npm for reproducibility.
- Alembic migrations exist — schema changes need a migration, not just
  model edits.

## Agent rules

- Branch from `main`; name branches `feat/*`, `fix/*`, `chore/*`, `docs/*`.
- Docs-only changes still go through a PR; never commit to `main` directly.
- Verify before claiming: run `pytest` and/or `cd frontend && npm test`
  and report the real result.
- Keep changes minimal and consistent with surrounding code. No drive-by
  refactors.
- Update AGENTS.md / docs/ARCHITECTURE.md when your change alters commands,
  module layout, or API contracts (both sides).
