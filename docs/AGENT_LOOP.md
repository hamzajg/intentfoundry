# The canonical agent loop — Define → Generate → Validate → Ship → Reflect

This document is the fleet's reference for structuring agentic work. It
describes what IntentFoundry actually implements — every claim below maps
to code, not aspiration. Other repositories' agent surfaces (agent tool
loops, copilot intents, curator facades) are the *mechanics*; this loop is
the *governance shape* they should grow into.

## The five stages

An `Iteration` (`app/models/domain.py`) progresses through a fixed order
(`STAGE_ORDER` in `app/api/v1/endpoints/loop.py`):

| Stage | What happens | Gate at exit |
|---|---|---|
| **Define** | Scope fixed: `spec_ids`, `active_adr_ids`, `bounded_context_id`, goal | "Specification sign-off" — specs complete, unambiguous, stakeholder-reviewed |
| **Generate** | AI produces output against the spec | "AI output review" — output checked against spec + architecture constraints |
| **Validate** | Fitness functions run (architecture governance) | "Fitness function gate" — all must pass; coverage vs acceptance criteria |
| **Ship** | Output delivered | "Acceptance criteria sign-off" — human confirms the *right thing* was built |
| **Reflect** | Learnings captured | "Reflection completion" — then iteration completes |

## Structural enforcement, not convention

The loop's value is that the gates are **code**, not process docs:

- **Checkpoints block advancement.** `POST .../advance` returns `409`
  listing pending required checkpoints; the iteration cannot move stages
  until a human resolves them (`resolve_checkpoint` → approved /
  rejected / skipped-with-reason).
- **Force is a governed exception, not a bypass.** `advance` with
  `force=true` requires `force_reason`, auto-skips pending checkpoints
  stamped `[FORCE ADVANCE]`, and emits an
  `iteration.checkpoints_force_skipped` telemetry event. Skipping is
  recorded, never silent.
- **Reflection feeds back into the specs.** `PUT .../reflection` writes
  `spec_learnings` and `adr_learnings` — the loop's output is *better
  specs and ADRs for the next iteration*, closing the cycle.

## Telemetry: the loop measures itself

Every transition emits an immutable `TelemetryEvent`
(`iteration.created`, `stage_advanced`, `checkpoints_force_skipped`,
`iteration.completed`, `iteration.reflection_updated`, …). `LoopMetric`
aggregates the four health indicators per iteration:

- `spec_rework_count` — how often specs needed rework
- `architecture_drift_count` — fitness/ADR violations caught
- `review_cycle_seconds` — human review latency
- `reflect_stage_completed` — did the loop close honestly

→ composite `loop_health_score` (0–100).

## How this maps to the rest of the fleet

| IntentFoundry mechanism | Fleet analog |
|---|---|
| Checkpoint = human decision gate | stream-weave's rule: *write tools need a confirmation protocol*; orca/al-minhej/PyGestComm read-only tool surfaces |
| Bounded stages, fixed order | stream-weave's bounded loop (6 iterations / 20 messages); al-minhej's `AGENT_MAX_ITERATIONS=4` |
| `toolTrace` / telemetry events | orca `tool_trace` in responses; al-minhej `ai_sessions.toolTrace`; here, durable `TelemetryEvent`s |
| `force` + reason + event | the "governance exception" pattern — any agent bypass must be logged, never silent |
| `spec_learnings`/`adr_learnings` | AGENTS.md/ADR updates in every feature PR — learnings become repo artifacts |

## Adopting the pattern in another repo

Minimum viable version (what we actually shipped elsewhere):

1. **Bounded loop** with an iteration cap.
2. **Read-only tools first** — writes require an explicit confirmation
   design (IntentFoundry's Checkpoint is the mature form).
3. **Every action observable** — trace/log the tool calls and stage
   transitions.
4. **Learnings persisted** — reflection output lands in the repo
   (ADRs, AGENTS.md, WORKQUEUE), not just chat history.

IntentFoundry is the reference because it implements all four with
structural enforcement and tests — start there before designing a new
agent surface.
