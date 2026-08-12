# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0 WORKFLOW

## Status
**PLANNED / NOT IMPLEMENTED.**

This workflow defines how TWM1 stages are implemented and verified without bypassing existing SG identity, authority, Action Gate, persistence, memory or transport boundaries.

## Global implementation rule
For every TWM stage:

```text
contract
→ persistence/schema where needed
→ deterministic service logic
→ authority/action-gate integration
→ Telegram/runtime wiring
→ tests
→ CI
→ live acceptance when the claim is production/live
→ documentation synchronization
```

No stage is CLOSED from documentation status alone.

## Preconditions
Before implementing a TWM stage:
1. verify current `dev/sg2.1-semantic` HEAD;
2. verify latest SG 2.1 CI result;
3. inspect actual relevant code/tests;
4. confirm prior TWM dependency stage is CLOSED;
5. preserve `main` as non-authoritative for SG 2.1 state evaluation.

## TWM1.1 — Workspace Contract & Lifecycle
Implement canonical contracts first. Add deterministic tests for valid workspace types/lifecycle, canonical workspace ids, scope isolation and Telegram group→supergroup migration mapping. Do not add persistence behavior before the contract is stable.

Acceptance: invalid/cross-workspace context fails closed and no ownership is inferred from metadata or invitation order.

## TWM1.2 — PostgreSQL Workspace Persistence
Add migrations/stores only for contract-approved entities. Preserve transactionality, unique Telegram resource mapping, canonical workspace isolation, versioned configuration and restart continuity.

Acceptance: PostgreSQL close/reopen preserves workspace/config/history without duplication or cross-workspace access.

## TWM1.3 — Workspace Discovery & Registry
Wire real Telegram update facts into a thin discovery adapter feeding `TelegramWorkspaceRegistry`. Transport reports platform facts only; registry owns canonical workspace resolution. Handle removal, reconnect and migration explicitly.

Acceptance: discovery is replay-safe/idempotent and multiple workspaces remain independent.

## TWM1.4 — Authority Verification
Reuse canonical Identity Links and Resource Authority. Query/re-verify Telegram resource authority according to sensitivity/freshness policy. Add bounded TWM roles only as workspace-scoped grants.

Acceptance tests must include:
- creator/admin allowed where policy permits;
- member denied;
- cross-workspace admin denied;
- stale/revoked admin evidence denied;
- no SG-global owner/Monarch escalation.

## TWM1.5 — Bot Permission Discovery
Capture actual Telegram bot membership/permissions and map them to bounded SG capability health. Missing permission is a first-class degraded result.

Acceptance: configured action requiring unavailable permission cannot report success and provides actionable missing-permission diagnostics.

## TWM1.6 — Workspace Configuration Service
Create the single mutation service. All configuration schemas and namespaces must be explicit. Mutation sequence:

```text
request
→ resolve workspace
→ authorize actor
→ validate key/value/schema
→ determine risk/confirmation policy
→ Action Gate when state-changing
→ atomic versioned write
→ history/audit/observability
```

Acceptance: direct writes from transport/UI/AI paths are absent or rejected.

## TWM1.7 — Action Gate Integration
Map TWM mutations and external effects to existing action classifications. Destructive/high-impact actions require explicit confirmation semantics and cannot be downgraded by user settings or model output.

Acceptance: callback, command, natural language and worker-driven attempts all converge on the same protected path.

## TWM1.8 — Telegram Native UI & Setup Wizard
Build inline keyboard UI as a presentation/controller layer only. UI callbacks carry opaque bounded identifiers and never encode authority. Re-resolve identity, scope and authorization server-side on every mutation.

Wizard acceptance: a new non-technical user can activate a workspace using only Telegram-native steps.

## TWM1.9 — Natural-Language Configuration
Add semantic intent/proposal generation. Prefer deterministic semantic resolution where possible; use AI Router only for bounded interpretation. Model payload/output is data-only and cannot grant authority or mutate storage.

Acceptance: natural-language request produces the same validated mutation result as equivalent UI selection.

## TWM1.10 — Runtime Wiring
Make Telegram runtime consume effective workspace configuration through an approved read interface. Configuration reads must be bounded/cached safely and invalidate predictably after writes.

Acceptance: real runtime response/moderation/publication behavior changes after config mutation and persists across restart.

## TWM1.11 — Audit, Rollback, Diagnostics
Expose history and rollback through authorized services. Rollback creates a new version and audit record; it does not delete history. Diagnostics are read-only and secret-safe.

Acceptance: SG can identify actor/time/before/after and restore a permitted prior version while retaining full audit chain.

## TWM1.12 — Production E2E & Live Acceptance
Use real Telegram group and channel acceptance with at least two human authority levels and two independent workspaces.

Required group scenario:

```text
new user
→ add SG
→ discover
→ verify admin authority
→ verify bot permissions
→ wizard setup
→ config mutation
→ runtime behavior proves mutation
→ restart
→ persisted behavior remains
→ member mutation denied
→ admin mutation allowed
→ admin rights revoked in Telegram
→ new mutation denied
→ second workspace unchanged
→ audit/history verified
```

Required channel scenario covers connect/authority, post-related bot permissions, configuration, publication policy behavior, restart and unauthorized denial.

CI may prove code/test behavior but cannot substitute for claims requiring real Telegram/live evidence.

## TWM1.13 — Telegram Mini App
Only after TWM1.12. Reuse the same backend APIs/services. Authenticate Telegram Mini App init data server-side and map it back through existing identity/authority boundaries. No separate business rules.

Acceptance: Mini App and chat/inline paths produce equivalent authorization/configuration semantics.

## Test layers
Each stage should use the appropriate combination of:
- unit contract/service tests;
- PostgreSQL integration tests;
- Telegram adapter/API contract tests;
- security/authority regression tests;
- runtime integration tests;
- E2E tests;
- real live Telegram acceptance for production claims.

## Required invariants
Throughout all stages:
- canonical human root remains `global_user_id`;
- canonical workspace root remains SG-issued `workspace_id`;
- Telegram IDs are platform locators only;
- Resource Authority remains authoritative for concrete-resource control;
- Action Gate remains authoritative for protected execution;
- AI Router is the only model path;
- AI output is never authority or direct mutation;
- workspace memory/settings/members/audit never cross scopes by default;
- bot/user authority can be revoked and re-verified;
- secrets never enter ordinary config/history/model context;
- UI convenience cannot weaken backend security.

## Documentation synchronization
After every CLOSED stage, synchronize:
- architecture status/evidence where material;
- `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md`;
- this workflow if acceptance procedure changes;
- canonical indexes where status/order references change;
- implementation/test paths and CI evidence.

## Final closure rule
TWM1.1–TWM1.12 are CLOSED only after the full multi-user, multi-workspace real Telegram acceptance passes. TWM1.13 remains a separately closable optional rich-UI extension.
