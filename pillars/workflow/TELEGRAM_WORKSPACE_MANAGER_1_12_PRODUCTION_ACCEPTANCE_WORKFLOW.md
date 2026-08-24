# TWM1.12 — Production Acceptance Workflow

## Rule
Run only against the deployed production revision. Do not fabricate missing observations and do not replace Telegram facts with mocks.

## Preconditions
- final implementation HEAD has green SG 2.1 CI;
- the same HEAD is deployed to production;
- one primary group/supergroup and one isolated group/supergroup are available;
- one primary channel and one isolated channel are available;
- an ordinary member account and a Telegram admin/creator account are available;
- SG bot has only the permissions intentionally required by the test.

## Group execution
Execute in order:
1. introduce a new SG user;
2. add SG to the primary group/supergroup;
3. observe canonical workspace discovery;
4. verify current admin/creator authority;
5. verify bot capability health;
6. complete native setup;
7. persist one bounded configuration change;
8. observe the matching runtime behavior change;
9. restart/redeploy the same production revision and prove the configuration remains effective;
10. attempt mutation as an ordinary member and prove denial/no write;
11. mutate as an authorized admin and prove one audited write;
12. remove that actor's Telegram admin rights;
13. attempt another mutation and prove fresh authority denial/no write;
14. perform an independent configuration operation in a second group and prove no cross-workspace state leak;
15. inspect audit/history and prove actor/version/before/after ordering.

## Channel execution
Repeat equivalent flow for a real channel. The configuration mutation and runtime observation must exercise publication-related configuration semantics that already exist in TWM1, without claiming TWM1.14 content-management functionality.

## Evidence record
Each observation supplied to the verifier must contain:
- exact scenario `step`;
- `source=telegram-production`;
- `passed=true` only after the fact is observed;
- ISO timestamp;
- trace id;
- request id;
- canonical workspace id;
- Telegram chat id;
- actor global user id when applicable;
- config version when applicable;
- bounded reason when useful.

Never include bot tokens, webhook secrets, raw credentials or unrelated message content.

## Verification
Build one manifest containing `environment=production`, deployed `revision`, `executedAt`, group scenario and channel scenario. Pass it to:

```js
createTelegramWorkspaceProductionAcceptance().verify(manifest)
```

A thrown error means TWM1.12 remains OPEN. Only `status: passed` plus green final CI and recorded live evidence permits closure.
