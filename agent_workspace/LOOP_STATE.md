# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `TEST-003`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `f9346eeb35f6b4bca7945b4a3b5e01fa1acff41c`
Last deploy ID: `dep-d7n20vbeo5us73f2otsg`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-26T14:29:54.701Z`

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
