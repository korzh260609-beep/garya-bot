# TWM1.9 — Natural-Language Configuration Evidence

## Status
CLOSED / IMPLEMENTED / CI-VERIFIED.

## Verified code gate
- Branch: `dev/sg2.1-semantic`
- Code HEAD: `80863ce9dc5ec7db70a1f00389bf5a41caaa7265`
- SG 2.1 CI: #7343
- Result: SUCCESS

## Verified documentation-synchronized gate
- Documentation HEAD: `ee4cffb0c9263395dc61426941219a0b650d7dd9`
- SG 2.1 CI: #7345
- Result: SUCCESS

Both successful full CI runs include dependency install, canonical PostgreSQL migration, Block 19 security gate, complete `npm run check`, web start, worker start and independent diagnostics verification.

## Implemented path
```text
addressed Telegram message
→ existing Telegram invocation boundary
→ existing production AI Router strict structured classification
→ deterministic authorized workspace resolution
→ bounded config patch
→ current TWM config read
→ deterministic deep merge
→ TWM1.6 proposeChange / validation / authority
→ durable actor-bound TTL pending proposal
→ explicit Telegram confirmation
→ exact stored proposal + original requestId
→ TWM1.7 canonical Action Gate
→ atomic PostgreSQL config/history write
```

## Proven acceptance properties
- ordinary conversation is not converted into a workspace mutation;
- no keyword/phrase command table decides NL configuration intent;
- AI output is data only and cannot authorize a workspace or write configuration;
- group/supergroup/channel context is authoritative and cross-workspace model redirection is rejected;
- private ambiguity causes workspace selection rather than guessing;
- patch merge preserves unrelated existing settings;
- no mutation occurs before explicit confirmation;
- confirmation executes the exact stored proposal and does not call AI again;
- pending proposal survives PostgreSQL restart;
- actor mismatch, expiry and replay cannot execute a second mutation;
- history questions return actor/version/time from deterministic stored history, not invented model facts;
- NL classifier failure falls through to the existing ordinary SG runtime;
- protected `twm19` callbacks fail closed and never fall through to ordinary chat;
- ordinary Telegram webhook success body remains backward-compatible.

## Tests
- `tests/telegramWorkspaceManager1NaturalLanguage.test.js`
- `tests/telegramWorkspaceManager1NaturalLanguagePostgres.test.js`
- `tests/telegramWorkspaceManager1NaturalLanguageIntegration.test.js`
- existing PostgreSQL compatibility/migration suites
- existing Telegram production integration suites

## Production composition
`src/runtime/renderWebApplication.js` composes TWM1.9 only when the existing TWM configuration backend, PostgreSQL workspace registry and production AI Router are available. TWM1.8 native UI remains independently usable.

## Scope boundary
TWM1.9 persists and safely applies workspace configuration. It does not claim that every persisted option already changes live Telegram behavior; that runtime-consumption responsibility belongs to TWM1.10.
