# TWM1.12 — Production E2E & Live Acceptance

## Status
**IMPLEMENTED — LIVE TELEGRAM ACCEPTANCE REQUIRED FOR CLOSURE.**

TWM1.12 does not add a second Telegram runtime or configuration path. It adds a fail-closed acceptance contract over the already implemented TWM1.1–TWM1.11 system.

## Acceptance boundary
A TWM1.12 PASS is valid only when evidence is bound to:
- environment = `production`;
- the deployed Git revision;
- real Telegram production observations (`source=telegram-production`);
- ordered group/supergroup acceptance;
- ordered channel acceptance;
- distinct primary and isolation workspaces;
- trace/request continuity for every observation.

Synthetic/unit/integration evidence may prove the verifier itself but can never satisfy the live gate.

## Group scenario
The exact ordered scenario is:

```text
new-user
workspace-added
workspace-discovered
authority-verified
bot-permissions-verified
setup-completed
config-saved
runtime-behavior-changed
restart-preserved-config
ordinary-member-denied
admin-mutation-allowed
admin-rights-lost
mutation-denied-after-rights-loss
second-workspace-isolated
audit-history-correct
```

## Channel scenario
The channel scenario repeats the same authority/isolation/restart controls and additionally proves publication configuration semantics:

```text
new-user
workspace-added
workspace-discovered
authority-verified
bot-permissions-verified
setup-completed
publication-config-saved
publication-behavior-changed
restart-preserved-config
ordinary-member-denied
admin-mutation-allowed
admin-rights-lost
mutation-denied-after-rights-loss
second-workspace-isolated
audit-history-correct
```

## Implementation
`src/telegramWorkspace/telegramWorkspaceProductionAcceptance.js` exposes:
- `TELEGRAM_WORKSPACE_PRODUCTION_ACCEPTANCE_VERSION`;
- `TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS`;
- `createTelegramWorkspaceProductionAcceptance()`.

The verifier rejects:
- non-production execution;
- unbound/missing deployed revision;
- synthetic/non-live evidence;
- incomplete or reordered scenarios;
- any failed acceptance observation;
- missing second-workspace proof;
- reused workspace identities between group and channel scenarios.

It does not mutate configuration, grant authority, call Telegram APIs, create workspaces or invent evidence. Those remain owned by TWM1.1–TWM1.11 and the existing Telegram production transport/runtime.

## Closure rule
TWM1.12 may be declared CLOSED only after:
1. full SG 2.1 CI succeeds on the final implementation/documentation HEAD;
2. that revision is deployed to production;
3. both real Telegram scenarios are executed;
4. the resulting live manifest passes `createTelegramWorkspaceProductionAcceptance().verify(...)`;
5. live evidence is recorded without secrets.

No CI-only or mocked result can substitute for item 2–5.
