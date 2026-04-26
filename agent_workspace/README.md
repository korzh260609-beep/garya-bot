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
6. Advisor writes a new `PENDING` command into `COMMANDS.md`.
7. GitHub webhook notifies SG that `COMMANDS.md` changed.
8. SG reads `COMMANDS.md`, resets stale reports, runs the allowlisted action, and writes fresh reports.
9. Advisor reads workspace reports and decides:
   - `VERIFIED_OK`;
   - `NEEDS_FIX`;
   - `STOP_MANUAL_REVIEW`.
10. A new loop starts only after explicit Monarch command.

---

## Event-driven command flow

```text
COMMANDS.md changed
→ GitHub webhook
→ POST /agent-workspace/github-webhook
→ SG reads COMMANDS.md
→ SG runs only STATUS=PENDING + allowlisted ACTION
→ SG resets stale report files
→ SG writes fresh reports
→ SG marks COMMANDS.md as DONE / FAILED / IGNORED
```

No cron and no polling are required for this flow.

---

## Hard limits

- SG must not deploy code.
- SG must not apply code changes automatically.
- SG must not modify production without Monarch action.
- Render reports are diagnostic evidence, not automatic permission to patch.
- Maximum loop attempts: `3`.
- SG reacts only to `agent_workspace/COMMANDS.md` changes.
- SG ignores report-file changes to avoid webhook loops.

---

## Runtime commands

- `/agent_workspace_diag` — check workspace config readiness.
- `/agent_workspace_run` — manual fallback: read `COMMANDS.md` and execute pending command once.
- `/agent_workspace_render_report <taskId> <workflowPoint> [deployId]` — collect RenderBridge deploy/log data and write reports.
- `/agent_workspace_test_note <taskId> <text>` — write a manual SG chat-test note into `TEST_REPORT.md`.

---

## Required ENV names on Render

Agent workspace:

```text
AGENT_WORKSPACE_ENABLED
AGENT_WORKSPACE_GITHUB_TOKEN
AGENT_WORKSPACE_REPO_FULL_NAME
AGENT_WORKSPACE_BRANCH
AGENT_WORKSPACE_BASE_PATH
```

Webhook:

```text
AGENT_WORKSPACE_WEBHOOK_ENABLED
AGENT_WORKSPACE_WEBHOOK_TOKEN
```

Optional:

```text
AGENT_WORKSPACE_DRY_RUN
AGENT_WORKSPACE_COMMIT_PREFIX
AGENT_WORKSPACE_GITHUB_API_BASE_URL
```

RenderBridge must also be ready for live Render collection:

```text
RENDER_BRIDGE_ENABLED
RENDER_API_KEY
```

Security note:
- the GitHub credential must be as narrow as practical;
- SG logic writes only allowlisted files in `agent_workspace/`;
- SG still must not write code, pillars, env, deploy config, or production settings.

---

## GitHub webhook setup

Repository settings:

```text
Settings → Webhooks → Add webhook
```

Payload URL:

```text
https://garya-bot.onrender.com/agent-workspace/github-webhook?token=<AGENT_WORKSPACE_WEBHOOK_TOKEN>
```

Content type:

```text
application/json
```

Events:

```text
Just the push event
```

Active:

```text
enabled
```

Important:
- the route also checks that the changed file is exactly `agent_workspace/COMMANDS.md`;
- changes to reports do not trigger command execution.

---

## Workspace files

- `COMMANDS.md` — event-driven command for SG.
- `INBOX.md` — current requested work item.
- `STATUS.md` — current execution status.
- `LOOP_STATE.md` — finite loop state and attempt counter.
- `DEPLOY_REPORT.md` — Render deploy metadata.
- `RENDER_REPORT.md` — Render logs and error snapshots.
- `DIAGNOSIS.md` — SG diagnosis based on logs/snapshots.
- `TEST_REPORT.md` — SG chat-command test results.
- `PATCH_REQUESTS.md` — requested follow-up fixes.
