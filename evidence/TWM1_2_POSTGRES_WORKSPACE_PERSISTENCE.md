# TWM1.2 — PostgreSQL Workspace Persistence Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED.**

## Scope
TWM1.2 adds durable PostgreSQL persistence for the contract-approved Telegram Workspace Manager entities from TWM1.1. It reuses the existing SG persistence/migration stack and does not introduce a second database, migration engine, identity system, authority system, memory, scheduler or Telegram transport.

## Implementation

### Migration
`src/persistence/migrations/900_twm1_workspace_persistence.sql`

Durable entities:
- `telegram_workspaces`;
- `telegram_workspace_members`;
- `telegram_workspace_bot_permissions`;
- `telegram_workspace_configs`;
- `telegram_workspace_config_history`.

The schema enforces:
- canonical SG `tgw_*` workspace roots;
- Telegram-only platform rows;
- unique `(platform, telegram_chat_id)` resource mapping;
- contract-approved workspace types/lifecycle states/roles/config namespaces;
- workspace foreign-key isolation with cascade cleanup;
- versioned current configuration plus immutable per-version history identity;
- timestamp validity constraints.

The migration is executed by the existing canonical SG migrator. SG 2.1 migration count is now 29 and compatibility tests explicitly include `900_twm1_workspace_persistence.sql`.

### PostgreSQL store
`src/telegramWorkspace/postgresWorkspaceStore.js`

Provides bounded persistence primitives for:
- workspace upsert/read/Telegram locator resolution;
- workspace member/role state;
- persisted SG bot permission snapshots;
- current workspace configuration;
- configuration version history.

`setConfig()` performs current-version locking, optional optimistic `expectedVersion` validation, version increment, current-config update and history insertion inside one PostgreSQL transaction.

All config/member/permission reads and writes are keyed by canonical `workspace_id`; Telegram chat ids remain platform locators rather than SG authority roots.

### Secret boundary
`assertWorkspaceConfigContainsNoSecrets()` rejects secret-shaped configuration/permission fields before persistence. Accepted configuration history is therefore sourced only from the validated config payload written in the same transaction. Bot tokens/secrets remain outside ordinary TWM workspace config/history.

### Migration compatibility
TWM1.1 group→supergroup migration can persist the same SG `workspace_id` while replacing the Telegram chat locator and retaining explicit migration provenance. The old Telegram locator no longer resolves after the remap.

## Tests
`tests/telegramWorkspaceManager1Postgres.test.js` verifies:
1. workspace/member/bot-permission/config/history durability across PostgreSQL close/reopen;
2. configuration version history survives restart;
3. two workspaces cannot leak configuration/history into each other;
4. stale optimistic config versions fail closed;
5. group→supergroup persistence preserves the SG workspace root and remaps the Telegram locator;
6. secret-shaped configuration fields are rejected before persistence.

`tests/postgresPersistence.test.js` was synchronized with the new canonical migration count and explicitly verifies the TWM1.2 migration is included in SG 2.0→SG 2.1 upgrade execution.

## CI evidence
Implementation/test HEAD: `d106c283ce5b8047e72ce75c209d7e5eebcbebb0`.

SG 2.1 CI **#7241 — SUCCESS**.
- migration gate: SUCCESS;
- Block 19 security gate: SUCCESS;
- `npm run check`: SUCCESS;
- runtime smoke: SUCCESS;
- worker smoke: SUCCESS;
- independent diagnostics verification: SUCCESS.

A preceding CI run correctly exposed two legacy assertions that hard-coded the former 28-migration total. They were updated to 29 and the final implementation CI passed; the TWM1.2 PostgreSQL tests themselves were already green in that earlier run.

## Boundary confirmation
TWM1.2 does **not** claim or implement:
- Telegram workspace discovery/registry (TWM1.3);
- Telegram authority verification (TWM1.4);
- live bot permission discovery (TWM1.5);
- the sole authorized Workspace Configuration Service mutation surface (TWM1.6);
- Action Gate integration (TWM1.7);
- Telegram UI/natural-language/runtime wiring (TWM1.8–TWM1.10);
- live Telegram production acceptance (TWM1.12).

Workspace member roles and bot permissions in this stage are durable scoped state only. They do not independently grant authority or prove live Telegram capability.

## Gate result
**PASS.** PostgreSQL close/reopen preserves workspace/config/history; writes are transactionally versioned; workspace data remains scoped by canonical workspace id; Telegram resource remapping preserves canonical workspace identity; secrets are rejected from ordinary workspace config/history; full SG 2.1 CI is green.
