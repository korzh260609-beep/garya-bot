# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `agent-workspace-command-timeout-240s-deploy-verify-20`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `e07174db425ae51ae9e4b621fb343d362bfe1d1b`
Last deploy ID: `dep-d7o5mm9j2pic739l4lrg`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-28T07:04:01.625Z`

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
