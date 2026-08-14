# Block 16.9 — External Connections Registry

## Status
Completed and CI-verified.

## Goal
Create one authoritative registry of external services connected to SG and the capabilities, owners, permissions and health state associated with each connection.

## Implemented
- stable `connection_id` contract with provider/service type and distinguishable external account identity;
- explicit `owner_global_user_id` and `project_scope` authority metadata;
- Block 16.8 credential handles only — no raw secret material in registry records;
- explicit granted scopes, permissions and provided capabilities;
- lifecycle: connect, reconnect, verification/health update and revoke;
- fail-closed `requireUsable()` boundary for unavailable/revoked connections;
- capability discovery APIs for Decision/Capability layers;
- PostgreSQL-backed durable store and migration `169_external_connections.sql`;
- deployment bootstrap for OpenAI and Telegram connections from already-registered credential handles;
- OpenAI Responses and Telegram Bot API production paths check registry usability before credential or network use;
- audit evidence contains actor, connection, provider, owner/project, operation, purpose and outcome without credential values;
- diagnostics expose registry readiness and safe connection identifiers only.

## Boundaries
- a connection is not a user identity;
- a connection does not imply ownership of every external resource;
- raw credentials are not stored in registry records;
- transport adapters may expose platform facts but do not become the registry;
- all state-changing connection operations remain permission-bound and audited;
- Block 16.10 remains authoritative for resource ownership/authority beyond connection-level account authority.

## Acceptance criteria
- [x] SG can answer which services are connected and under whose authority without exposing secrets;
- [x] connection permissions are explicit and bounded;
- [x] unavailable/revoked connections cannot silently execute capabilities;
- [x] multiple accounts for one provider remain distinguishable;
- [x] connection state survives restart and is scope-isolated;
- [x] production OpenAI/Telegram calls consume the registry boundary;
- [x] PostgreSQL migration, unit, integration, lifecycle, isolation and fail-closed tests exist.

## Evidence
Core implementation:
- `src/connections/externalConnectionsRegistry.js`
- `src/connections/postgresExternalConnectionStore.js`
- `src/connections/deploymentConnections.js`
- `src/persistence/migrations/169_external_connections.sql`

Production integration:
- `src/runtime/localProductionHarness.js`
- `src/runtime/renderWebApplication.js`
- `src/ai/createProductionAI.js`
- `src/ai/providers/openaiResponsesProvider.js`
- `src/telegram/telegramBotApiClient.js`

Tests:
- `tests/externalConnectionsRegistry.test.js`
- `tests/externalConnectionsPostgres.test.js`
- `tests/postgresPersistence.test.js`
- `tests/renderDeployment.test.js`

No new mandatory Render environment variable is introduced by Block 16.9.
