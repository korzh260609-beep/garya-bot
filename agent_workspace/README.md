# agent_workspace — SG Development Exchange Workspace

Purpose:
- exchange structured information between Monarch, external advisor, SG runtime, Render diagnostics, and repository workflow;
- keep development loops controlled, reviewable, and finite;
- avoid uncontrolled AI autonomy.

This folder is an operational workspace, not a source of architectural truth.

Authoritative sources remain:
- `pillars/DECISIONS.md`
- `pillars/workflow/*`
- repository code on the active branch
- explicit Monarch instructions

---

## Work protocol

1. Monarch selects a development point, for example: `implement 7.2`.
2. Advisor writes a short implementation plan:
   - what will be done;
   - expected result;
   - touched files;
   - risks.
3. Monarch approves or adjusts the plan.
4. Advisor prepares code and commits only after approval.
5. Monarch starts Render deploy.
6. SG collects deploy/runtime information through RenderBridge and writes reports here or into the database-backed report flow.
7. Advisor reads workspace reports and decides:
   - `VERIFIED_OK`;
   - `NEEDS_FIX`;
   - `STOP_MANUAL_REVIEW`.
8. A new loop starts only after explicit Monarch command.

---

## Hard limits

- SG must not deploy code.
- SG must not apply code changes automatically.
- SG must not modify production without Monarch action.
- Render reports are diagnostic evidence, not automatic permission to patch.
- Maximum loop attempts: `3`.

---

## Workspace files

- `INBOX.md` — current requested work item.
- `STATUS.md` — current execution status.
- `LOOP_STATE.md` — finite loop state and attempt counter.
- `DEPLOY_REPORT.md` — Render deploy metadata.
- `RENDER_REPORT.md` — Render logs and error snapshots.
- `DIAGNOSIS.md` — SG diagnosis based on logs/snapshots.
- `TEST_REPORT.md` — SG chat-command test results.
- `PATCH_REQUESTS.md` — requested follow-up fixes.
