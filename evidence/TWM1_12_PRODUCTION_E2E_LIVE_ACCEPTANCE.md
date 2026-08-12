# TWM1.12 — Production E2E & Live Acceptance Evidence

## Current state
Implementation is present. **Live Telegram acceptance is not yet claimed.**

## Code evidence
- `src/telegramWorkspace/telegramWorkspaceProductionAcceptance.js`
- `src/telegramWorkspace/index.js`
- `tests/telegramWorkspaceManager1ProductionAcceptance.test.js`

The verifier is deliberately fail-closed. It accepts only complete ordered production manifests bound to a deployed revision and `telegram-production` observations.

## Automated acceptance coverage
The TWM1.12 test suite proves the verifier:
- accepts a complete group + channel manifest;
- rejects synthetic/unit-test evidence;
- rejects missing steps;
- rejects reordered steps;
- rejects failed authority-loss assertions;
- rejects missing second-workspace isolation;
- rejects group/channel workspace identity collisions;
- rejects non-production execution;
- rejects acceptance not bound to a revision.

## Required live evidence
Closure still requires real Telegram production observations for both the group and channel scenarios defined by `TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS`.

Required proof includes:
- workspace discovery;
- fresh human authority verification;
- live bot permission verification;
- setup and persisted configuration;
- runtime behavior change;
- persistence through production restart/redeploy;
- ordinary-member mutation denial;
- authorized admin mutation;
- fresh denial after Telegram admin rights are removed;
- second-workspace isolation;
- correct append-only audit/history;
- equivalent channel publication-configuration semantics.

## Anti-false-closure rule
Mocked Telegram APIs, synthetic manifests, unit tests, CI success or documentation alone **do not satisfy the TWM1.12 gate**. The stage remains OPEN until the deployed revision has been exercised in real Telegram group/channel production flows and that evidence passes the verifier.
