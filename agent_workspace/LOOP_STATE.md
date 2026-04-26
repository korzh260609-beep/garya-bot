# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `-`
State: `EMPTY`
Attempt: `0`
Max attempts: `3`
Last approved by Monarch: `false`
Last commit: `-`
Last deploy ID: `-`
Last verification result: `-`

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
