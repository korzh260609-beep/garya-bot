# START_HERE

Start file for Advisor when entering SG AgentWorkspace work.

---

## Mandatory first read order

At the beginning of every SG project work session, Advisor must read these files first:

1. `agent_workspace/ADVISOR_PROTOCOL.md`
2. `agent_workspace/COMMANDS.md`
3. `agent_workspace/TEST_REPORT.md`
4. relevant source files for the active task

---

## Main rule

Advisor must automate diagnostics and tests through AgentWorkspace whenever possible.

The Monarch should not manually run SG diagnostic commands if Advisor can queue them through:

`agent_workspace/COMMANDS.md`

Advisor must:

1. queue the command;
2. trigger the workspace loop if needed;
3. read `TEST_REPORT.md`;
4. analyze the result;
5. report the next safe step.

---

## Protected files

Never edit `pillars/` unless the Monarch explicitly says:

`разрешаю изменить pillars`

---

## Proven command loop

Already verified:

- `/pm_context_diag`
- `/pm_shadow_context_diag`
- `/pm_shadow_fill_diag`

---

## Current protocol file

Full protocol:

`agent_workspace/ADVISOR_PROTOCOL.md`
