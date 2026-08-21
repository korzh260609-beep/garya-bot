# SG 2.1 — Lifecycle Activity (LA) Workflow

Status: ACCEPTED IMPLEMENTATION PROCEDURE / NOT IMPLEMENTED

Canonical architecture: `../architecture/LIFECYCLE_ACTIVITY.md`.
Canonical program: `../roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md`.

## Mandatory implementation sequence

Every LA stage follows the normal SG evidence discipline:

```text
scope
→ contract
→ additive code/migration
→ focused tests
→ observability/safety review
→ architecture boundary verification
→ exact-head CI
→ evidence update
```

## LA1 procedure

1. Inspect current PostgreSQL migration baseline and persistence conventions.
2. Add one additive migration for `activity_events`; do not modify unrelated tables.
3. Add one LA module boundary with event validation, normalization and query filter normalization.
4. Implement `recordActivity`, `safeRecordActivity`, `getRecentActivity` using existing persistence patterns.
5. Ensure metadata size/content is bounded and secret-safe.
6. Add focused unit/persistence tests, including fail-open recording behavior.
7. Verify no authoritative runtime path depends on successful LA persistence.
8. Run complete SG checks and exact-head CI.
9. Update canonical status only after evidence exists.

## LA2 procedure

1. Inspect current semantic interpreter/planner and Temporal Context seams before changing routing.
2. Add typed `activity_query` intent/subtypes without phrase-only routing.
3. Resolve time/source/category/entity/correlation filters into the LA query contract.
4. Apply current identity/scope/visibility restrictions before returning records to composition.
5. Preserve distinctions between activity-history questions and capability/self-knowledge/memory questions.
6. Add paraphrase, scope-isolation, empty-result and ambiguity regressions.
7. Run complete SG checks and exact-head CI.

## LA3 procedure

1. Add deterministic grouping by correlation and related meaningful events.
2. Add short/normal/detailed renderers using current response-mode conventions.
3. Preserve failed, cancelled, skipped and partial states honestly.
4. Do not expose raw metadata/internal identifiers by default.
5. If optional AI narrative is used, route it only through AI Router after deterministic facts are fixed.
6. Add regressions proving truthful status and stable chronology.
7. Run complete SG checks and exact-head CI.

## Producer integration rule

Do not perform repository-wide instrumentation as part of LA1-LA3. Each producer integration must be a focused additive patch, for example:

```text
existing successful domain action
→ safeRecordActivity(minimal linked event)
```

The producer remains authoritative. LA stores a concise linked event, not a copied domain object.

## Security and privacy checks

Before closing any stage verify:
- no secret/raw credential enters event fields or metadata;
- global user/workspace visibility boundaries are enforced;
- LA records do not grant roles, permissions, ownership or authority;
- activity queries cannot be used to discover inaccessible underlying resources;
- diagnostics/observability may inspect LA failures without leaking private event content;
- LA failure cannot block the original domain action.

## Compatibility checks

Before closing LA1 ensure the contract can additively support later:
- multi-workspace activity;
- multi-transport activity;
- activity graphs;
- semantic search;
- retention/archive tiers;
- privileged audit surfaces;
- subscriptions/derived analytics.

No future feature is considered implemented merely because the fields are reserved.

## Evidence requirement

For every stage record:
- exact HEAD;
- changed files;
- migration/test impact where applicable;
- full check result;
- exact-head CI result;
- implementation lifecycle state.

Documentation alone is PLANNED evidence only.
