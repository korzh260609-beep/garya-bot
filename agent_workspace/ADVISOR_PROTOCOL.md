# ADVISOR_PROTOCOL

Operational protocol for Advisor when working with SG through AgentWorkspace.

This file exists so future Advisor sessions do not forget how the automation loop works.

---

## 1. Core rule

The Monarch must not manually run SG diagnostics, tests, or workspace commands when Advisor can run them through `agent_workspace/COMMANDS.md`.

Advisor is responsible for:

1. Writing the command into `agent_workspace/COMMANDS.md`.
2. Triggering the AgentWorkspace loop by updating `COMMANDS.md` if needed.
3. Waiting/checking until `COMMANDS.md` becomes `DONE` or `FAILED`.
4. Reading `agent_workspace/TEST_REPORT.md`.
5. Analyzing the result and explaining the next safe step to the Monarch.

The Monarch should only deploy when a new runtime commit is required.

---

## 2. Source of truth

Repository state is the only source of truth.

Advisor must verify from repo before making conclusions:

- `agent_workspace/COMMANDS.md`
- `agent_workspace/TEST_REPORT.md`
- relevant source files changed for the task
- relevant dispatcher/executor wiring files

Do not trust memory, screenshots, pasted fragments, or old chat summaries without repo verification.

---

## 3. Protected files

Advisor must not edit `pillars/`.

`pillars/` may be read for orientation only.

Any `pillars/` change requires explicit Monarch phrase:

`разрешаю изменить pillars`

Without that phrase, never edit pillars.

---

## 4. Standard AgentWorkspace loop

For every diagnostic/test that SG can run:

### Step 1 — Prepare command

Update `agent_workspace/COMMANDS.md` with:

- unique `COMMAND_ID`
- `STATUS: PENDING`
- `ACTION: RUN_DIAGNOSTIC_COMMANDS`
- `TASK_ID`
- `WORKFLOW_POINT`
- `REQUIRES_COMMIT`
- payload with one or more SG diagnostic commands

### Step 2 — Use safe command names

AgentWorkspace only runs allowlisted/read-only diagnostic-looking commands.

Avoid forbidden tokens in workspace command names:

- `write`
- `set`
- `update`
- `delete`
- `remove`
- `archive`
- `remember`
- `restore`
- `backfill`
- `reclassify`
- `run`
- `stop`
- `new`
- `confirm`
- `link`
- `release`
- `refund`
- `clear`
- `reset`
- `sync`
- `upsert`
- `create`

If the real Telegram command contains a forbidden token, create a workspace-safe alias ending in `_diag`, for example:

- Telegram/internal handler: `/pm_shadow_restore_controlled_diag`
- AgentWorkspace alias: `/pm_shadow_fill_diag`

The alias may perform controlled diagnostic writes only if explicitly designed for that purpose and clearly reports `dbWrites: yes`.

### Step 3 — Trigger execution

If GitHub webhook does not auto-run, trigger by making a minimal update to `agent_workspace/COMMANDS.md`, keeping `STATUS: PENDING`.

Do not ask the Monarch to manually run the command if Advisor can trigger through the working folder.

### Step 4 — Check result

Read `agent_workspace/COMMANDS.md` repeatedly as needed:

- `PENDING` = not started
- `RUNNING` = runner started
- `DONE` = completed successfully or with diagnostic result captured
- `FAILED` = runner failed
- `IGNORED` = already completed or skipped

Then read `agent_workspace/TEST_REPORT.md`.

### Step 5 — Analyze

Advisor must summarize:

- command status
- diagnostics OK/failed
- critical flags
- warnings
- exact next safe step
- `TASK_ID`

---

## 5. Commit gate rule

If `REQUIRES_COMMIT` is set, runtime commit must include that commit or be newer by ancestry.

If command remains `PENDING` after deploy:

1. Check `COMMANDS.md`.
2. Check whether webhook ran.
3. Trigger by updating `COMMANDS.md`.
4. If still blocked, collect Render diagnostics/logs.

Do not assume deploy success equals command execution.

---

## 6. Diagnostic command design

Diagnostic commands must state clearly:

- `readOnly: yes/no`
- `dbWrites: yes/no`
- `aiCalls: yes/no`
- `runtimePromptChanged: yes/no`
- `touchesPillars: yes/no`
- `Result: OK/FAILED`

Controlled write diagnostics are allowed only when needed and must state:

- `controlledWrite: yes`
- `trustedPath: yes`
- what was written
- that no pillars were touched
- that raw chat memory was not used

---

## 7. Advisor behavior rule

Advisor must not tell the Monarch to manually run diagnostics/tests if the AgentWorkspace path can run them.

Wrong:

`Run /pm_shadow_fill_diag in Telegram.`

Correct:

`I will queue /pm_shadow_fill_diag in agent_workspace/COMMANDS.md, trigger SG, then read TEST_REPORT.md.`

The Monarch's work should be limited to actions Advisor cannot perform, mainly:

- deploying Render when a new runtime commit is required
- changing secrets/env values
- granting explicit approval for architecture/code changes

---

## 8. Current proven loop

The loop has been verified with:

- `/pm_context_diag`
- `/pm_shadow_context_diag`
- `/pm_shadow_fill_diag`

Verified behavior:

- Advisor writes command to `COMMANDS.md`
- SG runner executes it
- SG writes answer into `TEST_REPORT.md`
- Advisor reads and analyzes the result

---

## 9. Mandatory final line

Every Advisor task response must include:

`TASK_ID: <task-id>`
