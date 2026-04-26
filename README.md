# IntentFoundry

**Open source human-AI collaboration framework.**
*Specification and architecture at the centre of every project.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)

---

## What is IntentFoundry?

IntentFoundry operationalises the principle that **AI agents should build within human-defined constraints — not invent around them**.

It provides:

- **Intent Management** — versioned BDD/CDC/example-driven specifications connected to project context
- **Architecture Governance** — ADRs and fitness functions that travel with prompts and run in CI
- **Collaboration Loop** — the five-stage sprint cycle (Define → Generate → Validate → Ship → Reflect) with enforced human decision checkpoints
- **Loop Telemetry** — real-time visibility into spec rework, architecture drift, review cycle health, and reflect stage completion

IntentFoundry is the connective tissue between intent and execution. It is not a project management tool, an AI coding tool, or a documentation platform. It is what sits between them and keeps them aligned.

---

## Quick start

### Prerequisites

- Python 3.11+
- SQLite (zero-config, default) or PostgreSQL
- Redis (optional — enables real-time SSE telemetry)

### Local development (SQLite, no Docker)

```bash
# Clone
git clone https://github.com/hamzajg/intentfoundry.git
cd intentfoundry

# Install
pip install -e ".[dev]"

# Configure
cp .env.example .env
# Edit .env if needed — defaults work out of the box

# Run
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs — the full API is documented and interactive.

### Docker (PostgreSQL + Redis)

```bash
docker compose up
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

---

## API overview

All endpoints are under `/api/v1/`. Authentication via `Bearer` JWT or `X-API-Key` header.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user |
| POST | `/auth/api-keys` | Create API key (CI/CD) |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/{id}` | Get project |
| PATCH | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Soft delete |

### Intent (Specifications)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/{id}/specs` | List specs |
| POST | `/projects/{id}/specs` | Create spec (BDD/CDC/Example/Free) |
| GET | `/projects/{id}/specs/{sid}` | Get spec |
| PATCH | `/projects/{id}/specs/{sid}` | Update spec (auto-versions) |
| GET | `/projects/{id}/specs/{sid}/versions` | Version history |
| GET | `/projects/{id}/specs/{sid}/versions/{n}` | Specific version |

### Architecture
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/{id}/adrs` | List ADRs |
| POST | `/projects/{id}/adrs` | Create ADR (auto-numbered) |
| PATCH | `/projects/{id}/adrs/{aid}` | Update ADR / change status |
| GET | `/projects/{id}/fitness` | List fitness functions |
| POST | `/projects/{id}/fitness` | Create fitness function |
| POST | `/projects/{id}/fitness/run` | Execute checks |
| GET | `/projects/{id}/contexts` | List bounded contexts |
| POST | `/projects/{id}/contexts` | Create bounded context |
| POST | `/projects/{id}/ai-context` | **Build AI context package** |

### Loop (Sprint cycle)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/{id}/sprints` | List sprints |
| POST | `/projects/{id}/sprints` | Create sprint |
| POST | `/projects/{id}/sprints/{sid}/advance` | Advance stage |
| PUT | `/projects/{id}/sprints/{sid}/reflection` | Stage 5 reflection |
| GET | `/projects/{id}/sprints/{sid}/checkpoints` | List checkpoints |
| POST | `/projects/{id}/sprints/{sid}/checkpoints/{cid}/resolve` | Human sign-off |

### Telemetry
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/{id}/telemetry/events` | Event log |
| GET | `/projects/{id}/telemetry/metrics` | Loop metrics per sprint |
| GET | `/projects/{id}/telemetry/health` | Project health summary |
| GET | `/projects/{id}/telemetry/stream` | **SSE real-time stream** |

---

## The AI context package

The most important endpoint for CI/CD integration:

```bash
POST /api/v1/projects/{project_id}/ai-context
X-API-Key: if_your_api_key

{
  "spec_ids": ["01HZQ...", "01HZR..."],
  "adr_ids": null,                  // auto-selects linked ADRs
  "bounded_context_id": "01HZS...",
  "include_fitness_constraints": true,
  "format": "markdown"              // markdown | json | yaml
}
```

Returns a formatted context package ready for injection into any AI agent prompt — containing the specifications, active architectural decisions, bounded context constraints, and fitness function rules that govern what the AI should build.

---

## Spec formats

### BDD (Given/When/Then)
```json
{
  "format": "bdd",
  "content": {
    "bdd_scenarios": [{
      "title": "Successful login",
      "given": ["a registered user with a verified email"],
      "when": ["they submit valid credentials"],
      "then": ["they receive a JWT token with 24h expiry"]
    }],
    "acceptance_criteria": ["Token includes user ID in sub claim"]
  }
}
```

### CDC (Contract-Driven)
```json
{
  "format": "cdc",
  "content": {
    "cdc_contracts": [{
      "method": "POST",
      "path": "/auth/login",
      "responses": {
        "200": {"schema": {"token": "string", "expires_in": "integer"}},
        "401": {"schema": {"error": "string"}}
      }
    }]
  }
}
```

### Example-Driven
```json
{
  "format": "example",
  "content": {
    "example_tables": [{
      "description": "Price formatting boundary values",
      "columns": ["input", "expected_output", "expected_error"],
      "rows": [
        [0, null, "INVALID_PRICE"],
        [1, "$0.01", null],
        [99999999, "$999,999.99", null]
      ]
    }]
  }
}
```

---

## Fitness function types

| Type | Description |
|------|-------------|
| `regex` | Pattern must / must-not appear in files matching a glob |
| `dependency_limit` | No module may exceed N imports |
| `custom_script` | Inline Python or bash script (exit 0 = pass) |
| `api_check` | External endpoint must return expected HTTP status |
| `ast_rule` | AST-based rule (Phase 2) |

---

## Running tests

```bash
# All tests
pytest tests/ -v

# Unit tests only (no DB)
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# With coverage
pytest tests/ --cov=app --cov-report=term-missing
```

---

## Project structure

```
intentfoundry/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/
│   │   │   ├── auth.py         # Auth + API keys
│   │   │   ├── projects.py     # Project CRUD
│   │   │   ├── intent.py       # Spec management
│   │   │   ├── architecture.py # ADRs, fitness, contexts, AI builder
│   │   │   ├── loop.py         # Sprint lifecycle + checkpoints
│   │   │   └── telemetry.py    # Metrics + SSE stream
│   │   ├── deps.py             # FastAPI dependencies
│   │   └── router.py           # Route registration
│   ├── core/
│   │   └── config.py           # Settings (pydantic-settings)
│   ├── db/
│   │   └── database.py         # Engine, sessions, health check
│   ├── models/
│   │   ├── base.py             # ULID PK, timestamps, soft delete
│   │   └── domain.py           # All domain models
│   ├── schemas/
│   │   └── schemas.py          # Pydantic v2 request/response schemas
│   ├── services/
│   │   ├── auth_service.py     # JWT, API keys, password hashing
│   │   ├── fitness_service.py  # Fitness function execution
│   │   ├── context_service.py  # AI context package builder
│   │   └── telemetry_service.py # Event emission + metric computation
│   └── main.py                 # FastAPI app factory
├── tests/
│   ├── conftest.py             # Shared fixtures
│   ├── unit/                   # Pure logic tests
│   └── integration/            # Full HTTP cycle tests
├── alembic/                    # Database migrations
├── .github/workflows/ci.yml    # CI + fitness check pipeline
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
└── .env.example
```

---

## Roadmap

**Phase 1 — Current (this release)**
- Four core capabilities: Intent, Architecture, Loop, Telemetry
- REST API + SSE streaming
- SQLite (dev) + PostgreSQL (production) support
- JWT + API key authentication

**Phase 2 — AI Agent Builder & Runner**
- Agent definition API (model, system prompt, context config)
- LiteLLM router for model-agnostic execution
- Context auto-injection from IntentFoundry specs + ADRs
- Agent execution history and result validation
- Multi-agent orchestration for complex sprint tasks

**Phase 3 — Ecosystem**
- CLI tool (`if` command)
- VS Code extension
- GitHub App for PR-level fitness checks
- Community plugin registry for custom fitness function types

---

## Community

Join the conversation at **[tanoshii-computing.com/community](https://tanoshii-computing.com/community)**

Built by [Tanoshii Computing](https://tanoshii-computing.com) — open to contributors, collaborators, and anyone living this transformation day by day.

---

## License

MIT — see [LICENSE](LICENSE)
