# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `TEST-001`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `d16ec23f0224346ae33be4d2ec89364c1bbc8130`
Last deploy ID: `dep-d7n0kor7uimc73b62alg`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-26T12:54:24.416Z`

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
