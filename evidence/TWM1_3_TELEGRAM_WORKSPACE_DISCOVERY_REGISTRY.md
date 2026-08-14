# TWM1.3 — Telegram Workspace Discovery & Registry Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED**

## Scope
TWM1.3 implements Telegram workspace discovery and canonical registry resolution over the existing Telegram production integration and TWM1.2 PostgreSQL persistence. It does not implement TWM1.4 authority verification or TWM1.5 live bot-permission discovery.

## Implemented code
- `src/telegramWorkspace/telegramWorkspaceDiscovery.js`
  - extracts deterministic workspace facts from Telegram `message`, `edited_message`, `channel_post`, `edited_channel_post` and `my_chat_member` updates;
  - accepts only group/supergroup/channel resources;
  - ignores private chats;
  - records platform metadata and bot membership state without inferring human authority;
  - detects both Telegram group→supergroup migration forms.
- `src/telegramWorkspace/telegramWorkspaceRegistry.js`
  - owns canonical workspace creation/resolution;
  - refreshes metadata without changing canonical `workspace_id`;
  - handles bot disconnect/reconnect lifecycle;
  - preserves one canonical workspace root through migration and replay;
  - uses monotonic timestamps so stale Telegram updates cannot roll registry state backward.
- `src/telegramWorkspace/postgresWorkspaceRegistry.js`
  - persists registry behavior over the TWM1.2 PostgreSQL store;
  - resolves prior migrated Telegram chat ids through the durable migration relation;
  - exposes bounded workspace listing.
- `src/telegramWorkspace/telegramWorkspaceDiscoveryIntegration.js`
  - thin transport-fact adapter into the registry.
- `src/telegram/postgresTelegramUpdateStore.js`
  - wires discovery into the existing Telegram ingestion path before invocation filtering;
  - ordinary ignored group/channel traffic can therefore discover/refresh a workspace without forcing SG to answer;
  - preserves backward compatibility for legacy query-only test doubles while real production PostgreSQL uses the transactional registry contract.

## Replay and migration guarantees
- repeated observation of the same Telegram chat resolves to the same canonical workspace;
- title/username refresh does not create a new workspace;
- independent Telegram chats receive independent canonical workspace roots;
- group→supergroup migration preserves the original SG `workspace_id`;
- replaying the migration event remains idempotent;
- replaying an old pre-migration group update resolves through the durable migration relation and cannot recreate a duplicate old group workspace;
- removal/disconnect preserves the workspace record rather than deleting it;
- reconnect restores connection lifecycle on the same workspace root.

## Authority boundary
TWM1.3 records Telegram resource and bot-membership facts only. It does not infer OWNER/ADMIN/editor authority from Telegram usernames, titles, inviter identity, message text or bot-add order. TWM1.4 remains responsible for current human authority verification.

## Tests
- `tests/telegramWorkspaceManager1Discovery.test.js`
  - group/supergroup/channel extraction;
  - private-chat exclusion;
  - membership facts without human authority inference;
  - migration forms;
  - metadata refresh and monotonic time;
  - disconnect/reconnect;
  - migration replay and stale old-chat replay.
- `tests/telegramWorkspaceManager1DiscoveryPostgres.test.js`
  - real PostgreSQL Telegram ingestion path;
  - ignored group/channel updates still discover workspaces;
  - duplicate update handling;
  - metadata refresh;
  - removal/reconnect;
  - group→supergroup migration;
  - persistent alias resolution after migration;
  - multiple workspace isolation;
  - PostgreSQL restart continuity.

## CI evidence
Implementation code gate:
- HEAD: `a007a159ab705d94eb31676115632d3ac71c5377`
- SG 2.1 CI #7266
- result: **SUCCESS**
- migrations: SUCCESS
- Block 19 security gate: SUCCESS
- full `npm run check`: SUCCESS
- runtime smoke: SUCCESS
- worker smoke: SUCCESS
- independent diagnostics verification: SUCCESS

## Non-claims
This evidence does not claim:
- live Telegram owner/admin authority verification;
- current bot permission enumeration such as post/delete/restrict/pin/invite rights;
- authorized workspace configuration mutation;
- Action Gate integration for TWM mutations;
- setup UI or natural-language configuration;
- workspace runtime behavior changes;
- real external Telegram live acceptance beyond CI/integration fixtures.

Those remain later TWM stages.
