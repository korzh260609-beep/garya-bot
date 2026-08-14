# TWM1.1 — Workspace Contract & Lifecycle Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED.**

This evidence applies only to TWM1.1. It does not claim TWM1.2+ persistence, discovery, authority verification, runtime wiring or live Telegram acceptance.

## Implementation
- `src/telegramWorkspace/workspaceContract.js`
- `src/telegramWorkspace/index.js`
- `src/contracts/context.js`
- `tests/telegramWorkspaceManager1Contract.test.js`
- `tests/telegramWorkspaceManager1ContextIntegration.test.js`

## Verified contract
TWM1.1 now provides:
- SG-issued canonical `workspaceId` (`tgw_*`) independent from Telegram title/username;
- workspace types `group`, `supergroup`, `channel`;
- lifecycle `DISCOVERED → CONNECTED/CONFIGURING/ACTIVE/DEGRADED/DISCONNECTED/REVOKED` with explicit transition validation;
- terminal `REVOKED` semantics;
- strict request/action scope carrying canonical `workspaceId`, `globalUserId`, `traceId` and bounded action;
- canonical `ScopeContext.workspaceScope` integration with backward-compatible `null` for non-workspace requests;
- fail-closed rejection of non-canonical/cross-workspace scope;
- explicit group→supergroup migration preserving the same SG workspace root while changing the Telegram chat locator;
- bounded workspace roles and configuration namespaces;
- no ownership inference from names, usernames or invitation order.

## Reuse / boundary confirmation
TWM1.1 adds no Telegram transport, no persistence store, no identity system, no authority resolver, no scheduler and no AI write path. It is a domain contract layer integrated into the existing canonical scope context and intended to be consumed by the existing Telegram Production Integration, Identity & Scope, Resource Authority, Action Gate and PostgreSQL layers in subsequent TWM stages.

## CI evidence
Restored baseline:
- HEAD `ed607ebfb18e390f1bd0fe2687125da9563df242`
- SG 2.1 CI #7226 — `SUCCESS`

Contract implementation gate:
- HEAD `b7089c79fccce2a11e8b206094eee4b342a46427`
- SG 2.1 CI #7229 — `SUCCESS`

Canonical scope integration gate:
- HEAD `fa72678cbd796dd163aa5208c664338ccb73223e`
- SG 2.1 CI #7232 — `SUCCESS`

## Closure boundary
TWM1.1 is CLOSED because its deterministic contract and canonical Identity & Scope integration gates are CI-verified. No persistence, discovery, authority-resolution, bot-permission, runtime or real Telegram live claim is made by this stage. TWM1.2 remains the next canonical stage and must add durable PostgreSQL persistence without changing the established canonical workspace identity semantics.
