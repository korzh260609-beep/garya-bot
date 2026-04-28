# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `agent-workspace-runner-refactor-deploy-verify-24`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `7e6ac5f628def62a9f3095627519f382cf94e275`
Last deploy ID: `dep-d7o65opkh4rs73bjdu30`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-28T07:36:25.226Z`

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
