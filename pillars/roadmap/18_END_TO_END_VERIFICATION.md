# Block 18 — End-to-End Verification

## Status
Completed and acceptance-verified.

Initial full acceptance CI: GitHub Actions `SG 2.1 CI` run **#6887**, commit `8f0102d62e7c41e2d07035367e2107040921c85f`, conclusion **SUCCESS**. The final documentation-sync HEAD must also remain green before Block 18 is treated as the active repository baseline.

## Goal
Prove SG 2.1 as one composed product through reproducible cross-module flows, not only isolated unit or contract tests.

Block 18 adds verification only. It does not create alternative runtime logic, bypass Action Gate, weaken Owner Security, introduce transport keyword routing, or replace live runtime/diagnostic evidence.

## Executable verification entrypoint

```bash
npm run test:e2e
```

The full CI path remains:

```bash
npm ci
npm run migrate
npm run check
npm start
npm run start:worker
```

`npm run check` includes `tests/e2eVerification.test.js` through Node's repository-wide test runner.

## Block 18 E2E suite

Primary suite: `tests/e2eVerification.test.js`.

It composes the real production-like runtime and verifies:

1. full input → Identity/Scope → Language/Conversation → Semantic → Action Gate → Capability → Delivery → Observability path;
2. two users remain identity-isolated and language-isolated;
3. group/thread scope is preserved through the runtime;
4. simultaneous conversations for one user remain independent;
5. cross-transport continuation fails closed until explicitly approved;
6. approved Global ID state retains user language/settings and Memory 2.0 data while another user cannot read them;
7. production Telegram identity maps only the configured canonical `global_user_id` to Monarch authority and keeps guest identity stable;
8. stale/forged Monarch role cannot execute owner-only changes;
9. deferred worker execution revalidates the original actor rather than trusting payload identity claims;
10. feature cohorts cannot grant missing authorization and kill switch wins over rollout targeting;
11. runtime startup creates revision-bound bounded Self Knowledge and exposes live readiness evidence;
12. PostgreSQL restart preserves confirmed memory and conversation continuity.

## Required-scenario evidence matrix

| Production-roadmap scenario | Reproducible automated evidence |
|---|---|
| Monarch and guest private conversation | `tests/e2eVerification.test.js`, `tests/renderDeployment.test.js` |
| Group mention/reply invocation | `tests/telegramProduction.test.js`, `tests/interfaces.test.js` |
| Two users in one group with isolated identity/language/conversation context | `tests/e2eVerification.test.js`, `tests/languageContext.test.js`, `tests/conversationContext.test.js` |
| Topic/thread isolation | `tests/e2eVerification.test.js`, `tests/conversationContext.test.js`, Telegram production tests |
| Multiple simultaneous conversations for one user | `tests/e2eVerification.test.js`, `tests/conversationContext.test.js` |
| Approved cross-transport conversation continuation | `tests/e2eVerification.test.js`, `tests/conversationContext.test.js` |
| Multilingual conversation/natural switching | `tests/e2eVerification.test.js`, `tests/languageContext.test.js` |
| Mixed-language technical input | `tests/e2eVerification.test.js`, `tests/languageContext.test.js` |
| Linked global identity retains approved settings | `tests/e2eVerification.test.js`, settings/language tests |
| Resource authority across users/resources | `tests/resourceAuthority.test.js` and runtime authority composition tests |
| External connection available/revoked/unavailable | connection-registry/deployment connection tests |
| Memory survives restart | PostgreSQL scenario in `tests/e2eVerification.test.js`, Memory 2.0 PostgreSQL tests |
| Conversation/session survives restart | PostgreSQL scenario in `tests/e2eVerification.test.js`, conversation persistence tests |
| Task creation/scheduled execution | production capability, temporal scheduling, durable worker tests |
| Protected confirmation and Action Gate denial | `tests/runtimeComposition.test.js`, Action Gate/capability tests |
| Self-description consistency/planned-vs-implemented distinction | `tests/e2eVerification.test.js`, `tests/selfKnowledge.test.js` |
| Live-state self-questions use runtime/diagnostic evidence | `tests/e2eVerification.test.js`, response-context/diagnostics tests |
| Owner-only system change denied to non-owner | `tests/e2eVerification.test.js`, `tests/ownerSecurity.test.js` |
| Original actor preserved through queued/worker/tool execution | `tests/e2eVerification.test.js`, `tests/ownerSecurity.test.js`, durable worker tests |
| Owner impersonation/identity-link rejection | `tests/e2eVerification.test.js`, `tests/ownerSecurity.test.js`, `tests/renderDeployment.test.js` |
| Retry/DLQ/idempotency | durable worker, event bus, delivery and capability executor tests |
| Duplicate Telegram update | Telegram production deduplication tests |
| Temporary AI/database/Telegram outage | production AI, persistence/runtime startup and Telegram retry/failure tests |
| Worker/restart recovery | durable worker and PostgreSQL runtime tests |
| Delivery routing vs delivery failure | delivery-router tests |
| Feature cohort/kill switch behavior | `tests/e2eVerification.test.js`, `tests/featureFlags.test.js` |
| Diagnostics/audit/event evidence | `tests/e2eVerification.test.js`, runtime composition, diagnostics and event-bus tests |

## Isolation invariants

Block 18 treats the following as hard failures:

- one user's identity becoming another user's identity;
- group/thread data appearing outside its scope;
- language or settings leaking across `global_user_id`;
- conversation turns crossing conversation/session boundaries without explicit continuation approval;
- confirmed/private Memory 2.0 records leaking across users/groups/threads;
- Self Knowledge being replaced by ordinary user memory or prompt text;
- resource/connection presence being treated as ownership or authorization;
- feature flags granting permission, authority or Action Gate approval;
- payload/AI/role claims creating Monarch authority;
- deferred execution replacing the original actor with a more privileged actor;
- protected actions executing after a DENY/downgrade decision.

## Failure and recovery invariants

- startup failure rolls back already-started resources;
- PostgreSQL persistence is used for restart-survival evidence in CI;
- duplicate external events/updates do not duplicate protected effects;
- worker retries are bounded and terminal failures reach DLQ where applicable;
- transport/provider/database errors remain visible and bounded;
- execution success and delivery success remain distinct;
- observability and diagnostics must provide traceable evidence without raw secrets.

## Acceptance criteria

- [x] a dedicated E2E verification suite exists;
- [x] the suite runs through the production-like composition root rather than an alternative SG implementation;
- [x] identity/scope/language/conversation/memory isolation is asserted;
- [x] approved cross-transport continuation is asserted and unapproved continuation fails closed;
- [x] canonical owner identity and anti-impersonation behavior are asserted;
- [x] original actor revalidation is asserted for deferred execution;
- [x] feature rollout and kill-switch behavior is asserted;
- [x] revision-bound Self Knowledge and live runtime evidence are asserted;
- [x] PostgreSQL restart survival for memory and conversation is asserted;
- [x] existing retry/DLQ/idempotency, Telegram deduplication, delivery, outage and worker-recovery suites remain part of `npm run check`;
- [x] `npm run test:e2e` is a first-class package script;
- [x] branch CI containing the executable Block 18 changes is successful (`#6887`).

## Acceptance result

Block 18 is complete. Its verification path is executable, CI-gated, PostgreSQL-backed where durability matters, and tied to the existing production composition rather than a parallel test implementation.
