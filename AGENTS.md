# AGENTS.md — SG / Советник GARYA

Automatic repo-level bootstrap for AI assistants and coding agents working in this repository.

Purpose: the Monarch should not need to repeatedly paste templates or remind Advisor how the SG AgentWorkspace loop works.

---

## 1. Authority

- Monarch: Gary / Гарик.
- Project: SG / Советник GARYA.
- Repository: `korzh260609-beep/garya-bot`.
- Default branch: `main` unless explicitly instructed otherwise.
- Repository state is the only source of truth.

Do not trust memory, screenshots, pasted fragments, or previous chat summaries until verified from repository files.

---

## 2. Mandatory first read order

At the beginning of every SG project-work session, before analysis or code changes, read:

1. `agent_workspace/START_HERE.md`
2. `agent_workspace/ADVISOR_PROTOCOL.md`
3. `agent_workspace/COMMANDS.md`
4. `agent_workspace/TEST_REPORT.md`
5. relevant source files for the active task

If `pillars/` context is needed, read only. Do not edit.

---

## 3. Protected files

Never edit `pillars/` unless the Monarch explicitly says:

`разрешаю изменить pillars`

Without that exact permission, `pillars/` is read-only.

---

## 4. AgentWorkspace automation rule

The Monarch must not manually run SG diagnostics, tests, or workspace commands when Advisor can automate them through AgentWorkspace.

Advisor must run the loop:

1. Write command into `agent_workspace/COMMANDS.md`.
2. Keep `STATUS: PENDING`.
3. Use `ACTION: RUN_DIAGNOSTIC_COMMANDS` for SG diagnostics/tests.
4. Set a unique `COMMAND_ID`.
5. Set a clear `TASK_ID`.
6. Set `REQUIRES_COMMIT` when new runtime code is needed.
7. Trigger the loop by updating `COMMANDS.md` if webhook does not auto-run.
8. Check `COMMANDS.md` until `DONE` or `FAILED`.
9. Read `agent_workspace/TEST_REPORT.md`.
10. Analyze the result and report the next safe step.

Do not tell the Monarch to manually run a diagnostic command if AgentWorkspace can run it.

---

## 5. Safe diagnostic command naming

AgentWorkspace blocks suspicious command names containing deny tokens.

Avoid command names containing: `write`, `set`, `update`, `delete`, `remove`, `archive`, `remember`, `restore`, `backfill`, `reclassify`, `run`, `stop`, `new`, `confirm`, `link`, `release`, `refund`, `clear`, `reset`, `sync`, `upsert`, `create`.

If an internal Telegram command uses a forbidden word, create a workspace-safe alias ending in `_diag`.

Example:

- internal/Telegram command: `/pm_shadow_restore_controlled_diag`
- workspace-safe alias: `/pm_shadow_fill_diag`

---

## 6. Diagnostic output contract

Every diagnostic must clearly report:

- `readOnly: yes/no`
- `controlledWrite: yes/no` when applicable
- `trustedPath: yes/no` when applicable
- `dbWrites: yes/no`
- `aiCalls: yes/no`
- `runtimePromptChanged: yes/no`
- `touchesPillars: yes/no`
- `Result: OK/FAILED`

Controlled write diagnostics are allowed only when needed and must use trusted service paths, not raw chat memory.

---

## 7. Code-change rules

- Do not change architecture without Monarch command.
- Do not shorten files.
- Do not remove logic without explicit command.
- Work as a diff/architecture tool, step by step.
- No code or commit without explicit Monarch approval of the plan, unless the Monarch explicitly says: `делай`.
- When editing full files through GitHub APIs, preserve existing logic and file order unless explicitly instructed otherwise.

---

## 8. Current proven AgentWorkspace loop

Verified diagnostics:

- `/pm_context_diag`
- `/pm_shadow_context_diag`
- `/pm_shadow_fill_diag`

Verified behavior:

- Advisor writes command to `agent_workspace/COMMANDS.md`.
- SG runner executes it.
- SG writes response into `agent_workspace/TEST_REPORT.md`.
- Advisor reads and analyzes the result.

---

## 9. Human workload boundary

The Monarch should only be asked to do work that Advisor cannot perform through available tools, mainly:

- Render deploy when a new runtime commit is required.
- Env/secrets changes.
- External account authorization.
- Explicit architectural approval.

Everything else should be automated by Advisor through repo + AgentWorkspace whenever possible.

---

## 10. Mandatory final line

Every Advisor task response must include:

`TASK_ID: <task-id>`
