# SG Automation 2.0 — Implementation & Verification Workflow

Status: ACTIVE SPECIFICATION FOR PLANNED IMPLEMENTATION

## Rule

Implement Automation 2.0 incrementally and keep the existing production automation path operational until each replacement/extension is CI-verified and live-accepted.

Canonical procedure for every AW2 stage:

```text
scope
→ contract
→ skeleton
→ config
→ minimal logic
→ unit/regression tests
→ observability
→ security verification
→ reversible commit
→ CI on exact HEAD
→ production/live evidence when required
```

## Sequence

1. AW2.1 workflow contract and backward-compatibility adapter.
2. AW2.2 canonical step contracts.
3. AW2.3 durable Workflow Executor.
4. AW2.4 per-step execution-time authorization.
5. AW2.5 autonomous read-only policy.
6. AW2.6 bounded state-changing execution envelope.
7. AW2.7 `automation-update` capability and persistence changes.
8. AW2.8 semantic target resolver.
9. AW2.9 same-automation patch semantics / duplicate prevention.
10. AW2.10 version/history persistence.
11. AW2.11 fresh runtime data collection abstraction.
12. AW2.12 workspace activity collector.
13. AW2.13 multi-workspace aggregation.
14. AW2.14 dynamic composition through deterministic logic/AI Router as appropriate.
15. AW2.15 failure/retry/partial semantics.
16. AW2.16 execution history and observability.
17. AW2.17 idempotency/restart continuity.
18. AW2.18 natural-language lifecycle integration.
19. AW2.19 regression/security/E2E test suite.
20. AW2.20 production deploy and live acceptance.

## Migration rules

- Existing one-shot and recurring `self-notification` tasks remain executable during migration.
- Existing schedule IDs may be mapped to stable `automationId`, but user-facing interaction must not require internal identifiers.
- Data migration must be idempotent and restart-safe.
- Existing task/schedule records are not silently duplicated.
- Old static notification behavior remains a valid simple workflow profile.

## Target resolution verification

For every update operation verify:

- canonical identity/scope is used;
- selector is based only on attributes actually available from semantic interpretation/current scope;
- zero candidates returns not-found/clarification;
- multiple candidates returns selection-required/clarification;
- exactly one candidate patches that automation;
- no hidden second schedule/task is created.

## Security verification

Every executable step must prove:

- access/entitlement still active;
- resource authority current where a resource is targeted;
- Action Gate evaluated immediately before protected execution;
- credentials are obtained only through Credential Manager/approved connection path;
- no worker/tool/AI can self-escalate;
- state-changing steps obey their stored execution envelope;
- read-only workflow does not gain state-changing capability through composition.

## Freshness verification

Collectors must expose evidence timestamps/windows. Tests must demonstrate that an execution after underlying data changes produces a different fresh result without modifying the workflow definition.

## Failure verification

Test independently:

- one of several resources unavailable → `partial` with explicit omission;
- authority revoked → affected resource denied/skipped and audited;
- temporary provider error → bounded retry;
- permanent error → no infinite retry;
- delivery failure → execution result retained and delivery state visible;
- no failure path reports false success.

## Idempotency verification

For one occurrence:

- duplicate scheduler materialization;
- worker crash after execution before acknowledgement;
- retry after lease expiry;
- process restart;

must not produce duplicate externally visible delivery.

## Live acceptance script

1. Confirm current branch HEAD and green CI.
2. Deploy exact HEAD.
3. Create or identify a daily 07:00 automation.
4. In natural language instruct SG to add fresh group/workspace activity information.
5. Confirm the same automation ID/version lineage changed and no duplicate active automation exists.
6. Move the schedule temporarily to a near execution time.
7. Generate new activity in at least one authorized workspace.
8. Let worker execute without a new user message.
9. Verify the delivered report contains fresh authoritative activity evidence.
10. Verify another inaccessible/revoked workspace is not read.
11. Verify execution/audit/version history.
12. Restart worker/runtime and prove continuity/idempotency.
13. Restore 07:00.

## Closure evidence

AW2.20 may close only with:

- exact HEAD;
- SG 2.1 CI run number + SUCCESS on that HEAD;
- production deployment evidence;
- live Telegram (or equivalent connected transport) execution evidence;
- version/update/no-duplicate evidence;
- fresh-data evidence;
- authority-loss evidence;
- restart/idempotency evidence;
- no unresolved regression in existing automation behavior.
