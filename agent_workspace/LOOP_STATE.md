# LOOP_STATE

Finite control state for the development loop.

---

Task ID: `repo-state-agent-compact-ai-prompt-deploy-verify-22`
State: `DEPLOY_CHECKED`
Attempt: `1`
Max attempts: `3`
Last approved by Monarch: `true`
Last commit: `69fdec9fe312fc850004910869b9e59e42798687`
Last deploy ID: `dep-d7o5qo9f9bms738thgug`
Last verification result: `NO_RENDER_ERRORS_FOUND`
Updated at: `2026-04-28T07:12:54.607Z`

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
