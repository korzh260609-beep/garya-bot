# SG 2.1 — Lifecycle Activity (LA) Program

Status: ACCEPTED / PLANNED / NOT IMPLEMENTED

Canonical architecture: `../architecture/LIFECYCLE_ACTIVITY.md`.

## Goal

Add a small, isolated, scalable activity-history capability that lets SG answer what it actually did and when, without turning activity history into memory, observability telemetry or a new orchestrator.

## LA1 — Activity Event Core

Scope:
- additive PostgreSQL migration for `activity_events`;
- stable ActivityEvent validation/normalization contract;
- `recordActivity(event)` and fail-open `safeRecordActivity(event)`;
- bounded `getRecentActivity(filters)` query API;
- initial indexes for actor/time/type/category/source/entity/correlation/workspace;
- meaningful-event policy and metadata redaction/bounds;
- unit/persistence tests;
- no production producer wiring beyond the minimum test seam required to validate the contract.

Acceptance:
- append works durably;
- query filters are deterministic and scoped;
- invalid/unbounded events fail validation;
- `safeRecordActivity` never causes the authoritative action to fail;
- no second DB/queue/worker/control stack exists;
- existing CI remains green.

## LA2 — Semantic Activity Query

Scope:
- transport-independent semantic intent `activity_query`;
- planner/subtypes for `recent`, `timeline`, `last_action`, `by_category`, `by_source`, `by_entity`, `by_period`, `by_correlation`;
- relative/absolute time range normalization through existing temporal context where available;
- access/scope filtering before activity reaches response composition;
- deterministic query execution through the LA query API;
- regression tests for paraphrases and ambiguity.

Typical user requests:
- “Что ты делал сегодня?”
- “Что было последним?”
- “Что происходило с GitHub?”
- “Когда ты последний раз делал push?”
- “Какие действия были по этой задаче?”

Acceptance:
- phrasing does not require commands or exact keywords;
- ordinary capability questions are not misrouted into activity history;
- scope isolation is preserved;
- unavailable/empty history is reported honestly;
- no Memory/HS semantic contract is redefined.

## LA3 — Human Activity Summary

Scope:
- deterministic grouping of correlated/related events;
- human-readable short/normal/detailed presentation;
- use existing SG response-mode preference when available;
- preserve event status, omissions and failure/partial state;
- optional AI narrative only through existing AI Router and only after deterministic facts are assembled;
- no fabricated completion or inferred authority.

Acceptance:
- a correlated chain can render as one concise result plus detailed timeline;
- failed/partial actions are not summarized as success;
- raw internal IDs/metadata are hidden by default;
- detailed mode can expose timestamps and meaningful event steps;
- AI is not required for truthful rendering.

## Integration order

Implementation must remain incremental:

```text
LA1 core/store/query
→ LA2 semantic read path
→ LA3 presentation
→ separately accepted producer integrations
```

Producer wiring into GitHub, Automation, Memory, AI Router, Telegram or future transports is additive and must be introduced deliberately with focused tests. Do not mass-instrument the repository in LA1-LA3.

## Scaling constraints reserved now

The initial schema/API must preserve:
- `globalUserId`;
- `workspaceId`;
- `transport`;
- `entityType`/`entityId`;
- `parentEventId`;
- `correlationId`;
- `importance`;
- `visibility`;
- bounded JSON metadata;
- namespace-compatible `eventType`.

These fields are the compatibility seam for later cross-system timelines, analytics, semantic search, subscriptions, audit views, activity graphs and retention tiers.

## Explicit non-goals

LA1-LA3 do not implement:
- event bus replacement;
- Kafka/Redis Streams;
- graph DB;
- embeddings/vector activity search;
- automated reports/notifications;
- new workers/schedulers;
- broad instrumentation of every code path;
- duplicate memory/project-history/cost stores.

## Closure policy

Each stage is closed only by exact-head code/tests/CI evidence. Architecture/program text alone never proves implementation, deployment or live behavior.
