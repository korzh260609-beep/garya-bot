# TWM1.4 — Workspace Authority Verification Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED.**

## Implementation gate
- branch: `dev/sg2.1-semantic`
- implementation HEAD: `acd4770cae660a811bb85d64d4ecce961b318c73`
- SG 2.1 CI: **#7274 — SUCCESS**
- full CI foundation passed migration, security gate, `npm run check`, runtime start, worker start and diagnostics verification.

## Implemented paths
- `src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js`
- `src/telegramWorkspace/index.js`
- `tests/telegramWorkspaceManager1Authority.test.js`
- `tests/telegramWorkspaceManager1AuthorityPostgres.test.js`

## Authority model proven
The resolver does not create a parallel Telegram transport, identity root or authorization database. It composes existing primitives:

```text
Telegram platform user id
→ canonical Identity Link
→ global_user_id
→ exact canonical workspace_id
→ current Telegram getChatMember evidence
→ bounded workspace role
→ existing Resource Authority relation/state/expiry
→ explicit allow/deny decision
```

Telegram creator/administrator status is evidence only for the selected Telegram workspace. It never creates SG-global admin/owner/Monarch authority.

## Freshness and revocation
- sensitive workspace actions always require live Telegram authority verification;
- low-risk reads may reuse only bounded policy-valid evidence within TTL;
- Resource Authority expiry/revocation remains authoritative;
- Telegram verification errors fail closed for sensitive actions;
- loss of creator/administrator status revokes the workspace member state and active Resource Authority grants;
- an existing SG workspace role may be stricter than Telegram status but cannot broaden it.

## Acceptance coverage
Deterministic tests prove:
- creator allowed where action policy permits;
- administrator allowed where action policy permits;
- ordinary member denied;
- target workspace is independently verified, so admin authority in Workspace A does not authorize Workspace B;
- stale low-risk evidence is reverified after TTL;
- live admin loss is denied and previous Resource Authority is revoked;
- Identity Link mismatch is denied before Telegram authority query;
- stricter SG workspace role remains restrictive;
- sensitive Telegram API failure does not trust stale authority;
- no result contains or writes an SG-global role escalation.

PostgreSQL integration proves:
- canonical identity link + workspace role + Resource Authority operate together using existing stores;
- workspace member and Resource Authority state survive PostgreSQL close/reopen;
- no SG-global access role is granted as a side effect;
- after restart, live Telegram authority loss revokes the persisted workspace authority.

## Boundaries not claimed
TWM1.4 does **not** claim:
- SG bot-permission discovery/capability health (TWM1.5);
- configuration mutation service authorization (TWM1.6);
- full TWM Action Gate integration (TWM1.7);
- native setup UI or natural-language configuration;
- workspace runtime behavior wiring;
- real Telegram production E2E/live acceptance.

Next canonical stage: **TWM1.5 — Bot Permission Discovery & Capability Health**.
