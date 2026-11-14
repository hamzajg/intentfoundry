# Architecture — intentfoundry

Current-state map. Descriptive, not aspirational; see `docs/adr/` for why.

## System shape

```
React SPA (frontend/, Vite build → app/static/)
   │ axios + Bearer JWT, /api/v1/*
   ▼
FastAPI (app/main.py, :8000)
   ├─ api/v1/endpoints/   auth, projects, intent, architecture, loop, canvas, telemetry
   ├─ modules/            intent · architecture · loop · telemetry  (domain logic)
   ├─ services/           auth_service, context_service, fitness_service, telemetry_service
   ├─ models/ + db/       SQLAlchemy + Alembic (SQLite default / Postgres)
   └─ core/               config, redis (optional SSE backend)
   │
   ▼
SQLite (default, zero-config) | Postgres + Redis (docker compose)
```

## Domain model

The product is a **collaboration loop**, not a CRUD app:

- **Intent** — versioned BDD/CDC/example specs bound to project context.
- **Architecture** — ADRs + fitness functions that must pass in CI.
- **Loop** — the five-stage cycle (Define → Generate → Validate → Ship →
  Reflect) with enforced human checkpoints; agents operate inside it.
- **Telemetry** — spec rework, architecture drift, review-cycle health,
  reflect completion. SSE stream when Redis is enabled.
- **Canvas** — per-project node/edge layout (`@xyflow/react`) persisted via
  `/projects/{id}/canvas`.

## Data flow

1. Auth establishes a JWT (`/api/v1/auth/*`); the axios client attaches it
   to every request and queues retries when offline.
2. Endpoints validate input with pydantic schemas, call into
   `app/modules/<domain>` for rules and `app/services/` for cross-cutting
   concerns (auth, context assembly, fitness checks, telemetry).
3. State persists via SQLAlchemy models; schema changes go through Alembic.
4. The built SPA is served from `app/static/` by the same FastAPI process
   in production; in dev the Vite server proxies `/api`.

## Frontend ↔ backend contract

Single source of truth: `app/api/v1/endpoints/*.py` defines paths and
pydantic schemas; `frontend/src/api/` is the only HTTP layer. Adding an
endpoint requires touching both (or documenting why not). `VITE_API_URL`
controls the base; default `/api/v1` assumes same-origin/proxy.

## Key decisions (see docs/adr/)

- Specs at the centre: agents build within human-defined constraints.
- SQLite default so the framework runs with zero infrastructure.
- Fitness functions in CI — architecture rules are executable, not prose.
- Human checkpoints are enforced in the loop, not advisory.
