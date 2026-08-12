# TWM1.6 — Workspace Configuration Service Evidence

## Status
**IMPLEMENTED / CODE-RUNTIME CI-VERIFIED.**

Implementation gate verified on `dev/sg2.1-semantic`:
- implementation HEAD: `7a36c708f916d1ae375d238b22416bd5cd86a5fa`;
- SG 2.1 CI #7293 — **SUCCESS**.

Final stage closure additionally requires the documentation-synchronization HEAD to pass SG 2.1 CI.

## Scope implemented
TWM1.6 introduces one authorized workspace-configuration service over the existing TWM1.2 PostgreSQL persistence boundary.

Canonical managed namespaces:
- `general`;
- `responses`;
- `moderation`;
- `memory`;
- `ai`;
- `publication`;
- `automation`;
- `notifications`;
- `members`.

`content`, `polls` and `media` remain persistence-reserved for later TWM stages and are rejected by the TWM1.6 mutation service.

## Implementation
Primary implementation:
- `src/telegramWorkspace/workspaceConfigurationService.js`;
- `src/telegramWorkspace/index.js`;
- `src/runtime/renderWebApplication.js`.

The service implements:
- authorized get/list;
- structured change proposal;
- bounded JSON/schema/value validation;
- recursive secret-shaped field rejection;
- workspace authority evaluation through `TelegramWorkspaceAuthorityResolver`;
- risk classification and explicit confirmation requirement;
- atomic versioned apply using TWM1.2 `expectedVersion` conflict protection;
- immutable append-only history through the existing config-history table;
- authorized rollback as a new version rather than history rewind/deletion;
- metadata-only audit/`resource.updated` event emission.

Mutation authority uses `workspace:configure` and forces fresh authority verification. Reads use `workspace:view` under the existing bounded authority policy.

## Persistence and migration
No new migration was required.

TWM1.6 reuses the canonical TWM1.2 tables created by `src/persistence/migrations/900_twm1_workspace_persistence.sql`:
- `telegram_workspace_configs`;
- `telegram_workspace_config_history`.

The current config write and history append remain one PostgreSQL transaction in `src/telegramWorkspace/postgresWorkspaceStore.js`. Stale proposals fail closed through optimistic `expectedVersion` conflict detection.

## Production runtime wiring
`src/runtime/renderWebApplication.js` composes TWM1.6 from the same PostgreSQL workspace store used by Telegram discovery and TWM1.5 capability state:

```text
PostgreSQL persistence
→ telegramUpdateStore.workspaceRegistry.store
→ TelegramWorkspaceAuthorityResolver
→ WorkspaceConfigurationService
→ Internal Event Bus / Observability
```

No second Telegram transport, identity system, authority system, configuration database or credential path was added.

## Direct-write boundary
`tests/telegramWorkspaceManager1ConfigurationBoundary.test.js` enforces the TWM1.6 gate:
- application code has exactly one `workspaceStore.setConfig(...)` owner: `workspaceConfigurationService.js`;
- direct SQL writes to `telegram_workspace_configs` remain only in `postgresWorkspaceStore.js`;
- Render production composition must expose the canonical authority + configuration service path;
- the existing TWM1.2 config/history migration is reused.

Therefore Telegram transport/UI/AI application paths do not own a direct workspace-config write path.

## Tests
Unit/service acceptance:
- `tests/telegramWorkspaceManager1Configuration.test.js`.

PostgreSQL/restart acceptance:
- `tests/telegramWorkspaceManager1ConfigurationPostgres.test.js`.

Mutation-boundary/runtime-wiring acceptance:
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`.

Covered behavior includes:
- exact managed namespace set;
- reserved later-stage namespaces rejected;
- schema/value/size/depth validation;
- secret-shaped fields rejected;
- low-risk atomic apply;
- medium/high-risk confirmation requirement;
- fresh authority verification for mutations;
- authority denial without persistence;
- proposal actor mismatch denial;
- stale proposal conflict without overwrite;
- version/history integrity;
- rollback creates a new version and preserves the chain;
- independent workspace isolation;
- PostgreSQL close/reopen continuity;
- metadata-only event/audit payloads;
- direct-write ownership boundary;
- production composition boundary.

## CI evidence
During implementation, SG 2.1 CI #7292 correctly failed because the new boundary test used a file URL where a filesystem path was required. The test was corrected with `fileURLToPath()`; the following full run passed.

Verified code/runtime gate:
- HEAD `7a36c708f916d1ae375d238b22416bd5cd86a5fa`;
- SG 2.1 CI #7293 — **SUCCESS**;
- `npm run check` — SUCCESS;
- migrations — SUCCESS;
- security gate — SUCCESS;
- runtime startup — SUCCESS;
- Telegram production startup — SUCCESS;
- Discord production/gateway startup — SUCCESS;
- worker startup — SUCCESS;
- diagnostics startup — SUCCESS.

## Explicit non-claims
TWM1.6 does **not** claim completion of:
- TWM1.7 Decision / Action Gate Integration;
- TWM1.8 Telegram Native UI & Setup Wizard;
- TWM1.9 Natural-Language Configuration;
- TWM1.10 effective configuration consumption by Telegram runtime behavior;
- TWM1.11 user-facing diagnostics/history UX;
- TWM1.12 real Telegram production E2E/live acceptance.

TWM1.6 classifies risk and enforces its own confirmation requirement at the configuration-service boundary. Canonical protected-action convergence through the existing SG Decision / Action Gate remains the responsibility of TWM1.7.