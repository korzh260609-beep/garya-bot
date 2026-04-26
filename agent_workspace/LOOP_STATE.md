# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `diagnostic`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `648bd962119168220e5dcadf596f9cf9af78628b`
Last deploy ID: `dep-d7n3lihj2pic738j6a8g`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-26T16:22:08.923Z`

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
