# TWM1.7 — Decision / Action Gate Integration Evidence

## Status
**IMPLEMENTED / CODE-CI-VERIFIED; canonical documentation synchronization and final closure CI pending.**

## Verified implementation point
- Code/runtime HEAD: `747a821de5a4fd19be766e0583e005b6ee8e38c0`.
- SG 2.1 CI #7307: **SUCCESS**.
- The run passed migrations, Block 19 security gate, full `npm run check`, web runtime startup, worker startup and diagnostics.

## Canonical mutation boundary
TWM1.7 routes workspace configuration mutations through the existing SG Action Gate instead of maintaining a parallel authorization mechanism:

```text
request / structured proposal
→ exact workspace + canonical actor
→ bounded TWM1.6 validation
→ fresh workspace:configure authority
→ service-derived risk
→ canonical ActionRequest
→ canonical SG Action Gate
→ request-bound confirmation + idempotency
→ allow only
→ atomic TWM1.2 config write + append-only history
→ metadata-only audit / event
```

`WorkspaceConfigurationService` now requires an injected protected mutation gate and cannot be constructed without it. Its `apply`, proposal application and rollback write paths evaluate that gate before `workspaceStore.setConfig(...)`.

## ActionRequest mapping
`src/telegramWorkspace/telegramWorkspaceActionGateIntegration.js` maps TWM mutations to canonical SG requests:

- `apply` → `telegram-workspace-config-apply`;
- `rollback` → `telegram-workspace-config-rollback`;
- action class is `state-changing`;
- actor is the canonical `global_user_id`;
- requested/effective project and workspace scope are explicit;
- required permission is `workspace:configure`;
- exact workspace Resource Authority evidence is attached;
- TWM service-derived risk is preserved;
- confirmation is bound to `requestId`;
- idempotency identity is bound to operation/workspace/namespace/base-version/request;
- trace and request identity remain explicit.

The adapter accepts only an existing `actionGate.evaluate` implementation. It does not construct or emulate a second Action Gate.

## Security properties verified
- **Fail closed:** non-`allow` Action Gate outcomes never reach persistence.
- **Fresh authority first:** unauthorized workspace actors fail before Action Gate and before any write.
- **No risk downgrade:** caller/model input cannot reduce the service-derived namespace risk.
- **Global policy floor preserved:** TWM settings cannot weaken canonical SG protected-action confirmation policy. Under the current SG policy, even low-risk state-changing configuration mutations require canonical request-bound confirmation.
- **Replay protection:** a previously authorized mutation request cannot be replayed into a second config write.
- **Rollback is protected:** rollback is a separate state-changing Action Gate operation and creates a new version rather than rewriting history.
- **Workspace isolation:** ActionRequest scope and Resource Authority are bound to the exact workspace.
- **No UI/AI bypass owner:** application-code boundary tests retain `WorkspaceConfigurationService` as the sole `workspaceStore.setConfig(...)` owner.
- **Secret-safe audit:** Action Gate and configuration telemetry contain bounded metadata only, not configuration values or credentials.

## Production wiring
`src/runtime/renderWebApplication.js` composes TWM1.7 from existing production primitives:

```text
existing PostgreSQL workspace store
+ existing TelegramWorkspaceAuthorityResolver
+ existing harness.actionGate
+ existing policy layer
+ existing Observability / Internal Event Bus
→ TelegramWorkspaceActionGateIntegration
→ WorkspaceConfigurationService
```

The TWM runtime is composed only when canonical Resource Authority registry/access context are available. If that real TWM runtime is available but the canonical Action Gate is absent, Render fails closed. Minimal legacy/test Render harnesses that do not compose the TWM Resource Authority runtime remain backward-compatible and do not accidentally instantiate a partial TWM mutation path.

No second Telegram transport, identity system, Resource Authority model, Action Gate, scheduler or configuration database was introduced.

## Persistence
No new migration is required. TWM1.7 deliberately reuses TWM1.2 migration/store primitives in `src/persistence/migrations/900_twm1_workspace_persistence.sql` and the existing atomic current-config/history transaction.

## Test coverage
Primary TWM1.7 tests:
- `tests/telegramWorkspaceManager1ActionGate.test.js`;
- `tests/telegramWorkspaceManager1ActionGatePostgres.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`;
- TWM1.6 configuration unit/PostgreSQL tests updated to exercise the protected mutation boundary.

Verified scenarios include:
- configuration service refuses construction without mutation gate;
- unconfirmed low-risk state change writes nothing;
- valid request-bound confirmation allows one mutation;
- replay is rejected before a second write;
- high risk cannot be downgraded by caller input;
- rollback uses a separate protected request;
- authority denial occurs before Action Gate/persistence;
- PostgreSQL restart preserves confirmed apply/rollback version history;
- production wiring reuses `harness.actionGate`;
- direct workspace config write ownership remains singular and internally gated;
- TWM1.2 persistence is reused rather than duplicated.

## Regression found and fixed
The first full integration run, SG 2.1 CI #7306, exposed three legacy Render regression tests. The initial TWM1.7 wiring required `harness.actionGate` even in minimal Render test harnesses that did not compose Resource Authority/TWM configuration runtime.

Fix commit `747a821de5a4fd19be766e0583e005b6ee8e38c0` restored the existing guarded composition rule:
- TWM authority/configuration runtime is composed only with canonical Resource Authority registry + access context;
- canonical Action Gate is then mandatory for that TWM runtime;
- non-TWM minimal Render harnesses remain valid.

SG 2.1 CI #7307 subsequently passed the complete suite.

## Non-claims
TWM1.7 does **not** claim:
- TWM1.8 Telegram Native UI / Setup Wizard;
- TWM1.9 natural-language configuration;
- TWM1.10 runtime consumption of effective workspace configuration;
- TWM1.11 user-facing audit/rollback diagnostics;
- TWM1.12 real Telegram production/live acceptance;
- callback/command/NL/worker surfaces that do not yet exist as implemented features.

What TWM1.7 does guarantee is that any present or future application surface that wants to mutate workspace configuration must converge on the sole configuration write owner, whose internal mutation boundary now requires canonical SG Action Gate authorization.