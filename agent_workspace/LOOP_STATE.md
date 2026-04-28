# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `agent-workspace-command-timeout-deploy-verify-18`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `82b44cf4e0ff699268c462833ea2d3fa40b21b0c`
Last deploy ID: `dep-d7o5h357vvec739i3si0`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-28T06:54:30.071Z`

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
