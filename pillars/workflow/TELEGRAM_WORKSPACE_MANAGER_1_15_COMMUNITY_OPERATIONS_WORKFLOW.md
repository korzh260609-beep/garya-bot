# SG 2.1 — TWM1.15 COMMUNITY OPERATIONS WORKFLOW

## Status
**PLANNED / NOT IMPLEMENTED.**

This workflow defines implementation and acceptance for TWM1.15 Community Operations, Engagement & Analytics.

## Global rule
For each substage:

```text
contract
→ reuse existing SG primitive where possible
→ persistence only where needed
→ deterministic service logic
→ authority/privacy/action-gate integration
→ Telegram/runtime wiring
→ tests
→ CI
→ live acceptance for live claims
→ documentation synchronization
```

No substage is CLOSED from documentation alone.

## Preconditions
1. verify current `dev/sg2.1-semantic` HEAD and CI;
2. inspect actual relevant code/tests;
3. preserve `main` as non-authoritative for SG 2.1 state;
4. reuse Memory 2.0, Conversation Context, Resource Authority, Action Gate, PostgreSQL, Durable Automation, task/capability system, AI Router and Observability;
5. do not create second Telegram transport, identity, task, memory or scheduler stack.

## TWM1.15.1 — Domain Contracts & Scope
Implement workspace-scoped contracts for forms, submissions, events, registrations, feedback, cases, FAQ/onboarding, content plans, decisions and analytics snapshots.

Acceptance: invalid/cross-workspace references fail closed; privacy and visibility are explicit.

## TWM1.15.2 — Persistence
Add PostgreSQL migrations/stores for new domain state only. Reuse canonical task/memory/conversation/automation persistence instead of duplicating it.

Acceptance: transactional writes, restart durability, replay safety and no cross-workspace leakage.

## TWM1.15.3 — Forms & Feedback
Implement progressive forms/questionnaires, validation, submissions, named feedback and real anonymous mode only when anonymity is technically preserved.

Acceptance: replay cannot duplicate submissions; private fields remain bounded; no false anonymity claim.

## TWM1.15.4 — Events & Participation
Implement RSVP, capacity, waitlist, cancellation and reminders. Competition/challenge/draw features require deterministic eligibility and auditable selection semantics.

Acceptance: capacity/waitlist state remains correct after retries/restart.

## TWM1.15.5 — FAQ & Onboarding
Implement approved workspace FAQ sources and newcomer onboarding using existing context/memory boundaries.

Acceptance: group answers cannot expose private user memory; unsupported answers degrade to bounded escalation rather than invention.

## TWM1.15.6 — Community Assistance & Moderation Workflows
Implement unanswered-question candidates, moderation queues, warnings/escalations and owner notifications. AI may classify candidates but cannot directly execute moderation.

Acceptance: actual Telegram permission and Action Gate are checked before external effects.

## TWM1.15.7 — Cases / Requests
Implement request lifecycle, assignment and operator queues.

Acceptance: role-scoped access, audit, restart durability and isolation.

## TWM1.15.8 — Tasks, Reminders & Decisions
Reuse existing task/automation systems. Implement proposal→discussion→optional vote→deterministic result→authorized decision confirmation→optional shared-memory promotion/action.

Acceptance: poll outcome is not silently promoted to binding decision or confirmed memory.

## TWM1.15.9 — Content Planning
Extend TWM1.14 with content calendar, draft queues, recurring rubrics and editorial approval using the same content service/scheduler.

Acceptance: no duplicate publisher/scheduler; execution-time authorization/capability rules remain enforced.

## TWM1.15.10 — Summaries & Unanswered Questions
Implement bounded AI Router summaries over authorized conversation context and deterministic unresolved-question state.

Acceptance: summaries stay derived until confirmed; no automatic memory/decision promotion.

## TWM1.15.11 — Analytics
Implement exact metric definitions and deterministic aggregation over deduplicated structured events.

Acceptance: restart/replay cannot change totals; AI narrative cannot change metrics.

## TWM1.15.12 — Briefs, Reports & Exports
Implement owner briefs and authorized export paths through available artifact capabilities.

Acceptance: reports distinguish exact metrics, AI interpretation and unavailable evidence; export respects same privacy/authority as source data.

## TWM1.15.13 — Production E2E
Use real Telegram workspace flows with at least two workspaces and multiple authority levels.

Required scenario:

```text
form → member submission → owner review
→ event registration/waitlist
→ onboarding/FAQ
→ case lifecycle
→ discussion summary
→ explicit decision confirmation
→ optional Group Shared Memory promotion
→ task/reminder
→ content plan/recurring publication
→ deterministic analytics snapshot
→ restart/replay
→ owner brief/export
→ unauthorized and cross-workspace denial
```

CI is necessary but does not replace real Telegram evidence for live claims.

## Test matrix
- unit contract/service tests;
- PostgreSQL integration/restart tests;
- workspace/user/thread isolation tests;
- privacy/authority regression tests;
- Telegram adapter/API contract tests;
- task/automation reuse tests;
- deterministic draw/analytics fixtures where applicable;
- replay/idempotency tests;
- AI Router proposal/summary tests proving output is non-authoritative;
- E2E/live Telegram acceptance.

## Required invariants
- `global_user_id` remains canonical human root;
- `workspace_id` remains canonical workspace root;
- operational records do not become Memory 2.0 records automatically;
- private user memory is never exposed as shared FAQ/context;
- explicit policy is required to promote a decision/fact to Group Shared Memory;
- AI Router is the only model path;
- AI output cannot mutate state, grant authority, fabricate metrics or create confirmed truth;
- all external effects remain Resource Authority + capability + Action Gate bounded;
- workspace isolation applies to forms, cases, events, feedback, FAQ, plans, tasks, decisions, analytics and exports;
- scheduled/repeated work reuses Durable Automation and revalidates authority/capability as policy requires;
- anonymity claims must match actual data availability/storage.

## Documentation synchronization
After every CLOSED substage synchronize:
- TWM1.15 architecture;
- TWM1.15 roadmap program;
- this workflow;
- TWM1 parent architecture/program/workflow where relationships/status change;
- canonical pillar indexes;
- code/test/CI/live evidence references.

## Closure rule
TWM1.15 is CLOSED only after TWM1.15.1–TWM1.15.13 are implemented, CI-verified and live-accepted with restart/replay, authority/privacy and cross-workspace isolation evidence.
