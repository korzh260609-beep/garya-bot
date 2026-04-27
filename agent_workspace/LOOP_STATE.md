# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `render-deploy-startup-lines-check`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `03f9138cb41aaee15a7953a78818c34bec73f0a9`
Last deploy ID: `dep-d7nns8n7f7vs73fter5g`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-27T15:29:02.222Z`

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
