# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `agent-workspace-command-runner-refactor-deploy-verify-15`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded`
Last deploy ID: `dep-d7o5ct2qqhas738a771g`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-28T06:43:04.612Z`

---

## State machine

```text
REQUESTED
→ PLAN_PROPOSED
→ APPROVED
→ COMMITTED
→ DEPLOYING
→ DEPLOY_CHECKED
→ VERIFIED_OK | NEEDS_FIX | STOP_MANUAL_REVIEW
```

---

## Stop rules

- Stop if `Attempt >= Max attempts`.
- Stop if Render deploy fails without clear diagnosis.
- Stop if diagnosis confidence is `very_low` after repeated failure.
- Stop if requested fix would change architecture without Monarch approval.
- Stop if DECISIONS / WORKFLOW conflict is detected.
