# SG 2.1 WORKFLOW — RELEASE AND ROLLBACK PROTOCOL

## Release readiness
A change may be released only when:
- acceptance criteria are satisfied
- required tests are green
- observability is present
- safety and negative paths are verified
- configuration defaults are safe
- secrets are not embedded
- migration or compatibility impact is understood
- rollback is defined

## Release sequence
1. verify clean change scope
2. run contract, unit and behavior tests
3. run integration and adapter tests where relevant
4. review permission, risk, cost and confirmation paths
5. verify logs, metrics and error surfaces
6. create one release commit or approved merge unit
7. deploy only through an explicit release action
8. run runtime smoke tests
9. record factual release evidence outside active workflow pillars

## Rollback
Every state-changing release defines:
- rollback trigger
- rollback procedure
- data compatibility constraints
- irreversible effects
- recovery verification

## Rules
- A successful build is not proof of correct behavior.
- A deployed change is not automatically an accepted architecture decision.
- Runtime incidents and provider-specific notes belong in reports or archive, not this workflow.
- Telegram, Render or any other platform is tested only when the selected adapter or deployment target requires it.
