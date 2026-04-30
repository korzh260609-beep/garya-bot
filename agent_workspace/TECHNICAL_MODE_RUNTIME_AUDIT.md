# TECHNICAL_MODE_RUNTIME_AUDIT.md

Дата: 2026-04-30  
Статус: AUDIT / NO RUNTIME CHANGES  
Ветка: `audit/technical-mode-runtime-2026-04-30`  
Основание: `pillars/DECISIONS.md`  
Владелец решения: Монарх Gary

---

# 0. Цель аудита

Этот аудит фиксирует, какие части текущего runtime относятся к старому техническому интерфейсу СГ и не должны считаться новым живым СГ.

Главное разделение:

```text
Technical Mode = команды, диагностика, debug, legacy routes, fixed phrases, regex, keyword triggers.
Living SG / Human Mode = естественное общение по смыслу через meaning -> intent -> capability -> permission -> risk -> confirmation -> answer/action.
```

Важно:
- этот файл ничего не меняет в runtime;
- этот файл не удаляет старую логику;
- этот файл является картой для будущей миграции;
- любые runtime-изменения выполняются только после отдельного решения монарха.

---

# 1. Каноническое правило

По новой философии СГ:

```text
СГ свободен в мышлении.
СГ управляем в действиях.
```

Следствие для runtime:

```text
Slash-команды, regex, fixed phrases и keyword routes не являются живым интеллектом СГ.
Они допустимы только как Technical Mode, compatibility layer, diagnostic shortcut или helper signal.
```

Запрещено считать:
- `/command` = способность СГ;
- fixed phrase = понимание СГ;
- regex route = Human Mode;
- keyword match = новый живой СГ;
- old RepoIndex route = factual SG intelligence.

---

# 2. Runtime-картина сейчас

Текущий runtime имеет смешанную архитектуру:

1. Новый смысловой слой:
   - `src/core/handleMessage.js`
   - `src/core/meaning/*`
   - `src/core/projectIntent/*`
   - `src/projectExperience/*`

2. Старый slash-command слой:
   - `src/bot/commandDispatcher.js`
   - `src/bot/dispatchers/*`
   - `src/bot/handlers/*`

3. Параллельные системы доступа:
   - `src/bot/cmdActionMap.js`
   - `src/bot/constants/privateOnlyCommands.js`
   - `src/core/commandPolicy/commandPolicies.js`
   - `src/users/permissions.js`

4. Fixed phrase / regex / keyword logic:
   - `core/answerMode.js`
   - `core/MemoryPolicy.js`
   - `src/bot/handlers/chat/chatPromptHeuristics.js`
   - `src/core/time/currentDateIntent.js`
   - `src/core/projectIntent/**`
   - `src/bot/handlers/stage-check/**`
   - `src/bot/handlers/repoAnalyze.js`
   - `src/repo/textFilters.js`

---

# 3. Slash commands audit

## 3.1 Technical Mode: project/repo/dev commands

Эти команды должны считаться Technical Mode only:

| Command | Current area | Mode | Action type | Risk | Migration note |
|---|---|---|---|---|---|
| `/reindex` | project repo | Technical Mode | state-changing / indexing | HIGH | keep monarch/private only; later replace natural repo capability with RepoStateAgent-backed flow |
| `/repo_status` | project repo | Technical Mode | read/diagnostic | MEDIUM | legacy shortcut; not Living SG |
| `/repo_tree` | project repo | Technical Mode | read/legacy snapshot | MEDIUM | legacy RepoIndex browsing only |
| `/repo_file` | project repo | Technical Mode | read file | MEDIUM | must remain gated |
| `/repo_search` | project repo | Technical Mode | read/search | MEDIUM | should not be Human Mode by itself |
| `/repo_analyze` | project repo | Technical Mode | read/analyze | MEDIUM | fixed path command; not Living SG |
| `/repo_diff` | project repo | Technical Mode | read/compare | MEDIUM | technical shortcut |
| `/repo_get` | project repo | Technical Mode | read file | MEDIUM | technical shortcut |
| `/repo_check` | project repo | Technical Mode | diagnostic | MEDIUM | technical shortcut |
| `/repo_review` | project repo | Technical Mode | diagnostic | MEDIUM | legacy review |
| `/repo_review2` | project repo | Technical Mode | legacy diagnostic | MEDIUM | old RepoIndex-backed review |
| `/workflow_check` | workflow | Technical Mode | diagnostic | MEDIUM | workflow provider should replace file-bound assumptions later |
| `/stage_check` | workflow/stage | Technical Mode | diagnostic | MEDIUM | keyword/stage logic is technical |
| `/code_output_status` | code output | Technical Mode | diagnostic | LOW/MEDIUM | technical command |
| `/project_intent_diag` | project intent | Technical Mode | diagnostic | LOW/MEDIUM | diagnostic only |

## 3.2 Technical Mode: task commands

These commands are explicit slash controls for Task Engine and must not be treated as Living SG:

| Command | Current area | Mode | Action type | Risk | Migration note |
|---|---|---|---|---|---|
| `/tasks` | task engine | Technical Mode / user shortcut | read | LOW | can remain user shortcut; natural Living SG should provide task listing by meaning later |
| `/newtask` | task engine | Technical Mode / legacy shortcut | state-changing | MEDIUM | natural task creation should go through capability + confirmation policy |
| `/new_task` | task engine | Technical Mode / legacy shortcut | state-changing | MEDIUM | same as `/newtask` |
| `/run` | task engine | Technical Mode | state-changing / execution | HIGH | must be guarded; natural run requires confirmation if costly/state-changing |
| `/run_task` | task engine | Technical Mode | state-changing / execution | HIGH | legacy alias |
| `/stop_task` | task engine | Technical Mode | state-changing | MEDIUM/HIGH | must be owner/monarch scoped |
| `/start_task` | task engine | Technical Mode | state-changing | HIGH | missing from `CMD_ACTION`; must be mapped before runtime hardening |
| `/stop_tasks_type` | task engine | Technical Mode | bulk state-changing | HIGH | missing from `CMD_ACTION`; must be monarch/private or strict scope |
| `/stop_all_tasks` | task engine | Technical Mode | global bulk state-changing | CRITICAL | missing from `CMD_ACTION`; must be monarch/private + explicit confirmation |
| `/stop_all` | task engine | Technical Mode | global bulk state-changing | CRITICAL | legacy alias; missing from `CMD_ACTION` |

## 3.3 Technical Mode: memory/project-memory commands

These commands are not normal Living SG. They are explicit technical memory controls.

| Command group | Mode | Risk | Migration note |
|---|---|---|---|
| `/pm_*` | Technical Mode | MEDIUM/HIGH | project memory read/write must later become controlled memory capability |
| `/pm_confirmed_*` | Technical Mode | HIGH | confirmed memory writes/updates need strict confirmation/logging |
| `/memory_*` | Technical Mode | MEDIUM/HIGH | diagnostics/backfill only; backfill is high risk |
| `/diag_decision*` | Technical Mode | LOW/MEDIUM | diagnostic only |
| `/command_policy_*` | Technical Mode | LOW/MEDIUM | policy diagnostics only |
| `/meaning_*_selftest` | Technical Mode | LOW | test commands; not Human Mode |

## 3.4 Technical Mode: system/dev/render/agent workspace

These are clearly Technical Mode:

| Command group | Mode | Risk | Migration note |
|---|---|---|---|
| `/render_*` | Technical Mode | MEDIUM/HIGH | deploy/log actions must be strict |
| `/render_bridge_*` | Technical Mode | MEDIUM/HIGH | `/render_bridge_deploy` is high risk |
| `/agent_workspace_*` | Technical Mode | HIGH | agent workspace run/report actions must be monarch/private |
| `/identity_*` | Technical Mode / identity tools | MEDIUM/HIGH | backfill/upgrade are state-changing |
| `/grant`, `/revoke`, `/grants` | Technical Mode / admin | HIGH | governance/admin controls |
| `/build_info`, `/webhook_info`, `/chat_meta_debug` | Technical Mode | LOW/MEDIUM | diagnostic only |
| crypto/dev diagnostics | Technical Mode | LOW/MEDIUM | not Living SG |

## 3.5 User-facing shortcuts that may remain shortcuts

These can remain as user-visible shortcuts, but must not define SG intelligence:

| Command | Current role | Future model |
|---|---|---|
| `/profile`, `/me`, `/whoami` | identity/profile shortcut | Living SG can answer naturally via profile capability |
| `/mode` | answer mode shortcut | Living SG should understand natural style requests; command remains shortcut |
| `/price`, `/prices` | price shortcut | Living SG should route natural price questions to price/source capability |
| `/sources`, `/source`, `/diag_source`, `/test_source` | source shortcuts | source capability + diagnostics split later |
| `/link_start`, `/link_confirm`, `/link_status` | identity linking | can remain explicit flow, not intelligence core |

---

# 4. Fixed phrase / regex / keyword audit

## 4.1 Core rule

Any code that works by direct text fragments must be classified:

```text
A. Technical Mode
B. helper signal
C. compatibility fallback
D. must migrate to meaning/capability layer
```

It must not be classified as Living SG itself.

## 4.2 Known zones

| Area | File / pattern | Current concern | Classification | Future direction |
|---|---|---|---|---|
| answer mode | `core/answerMode.js` | user style may be controlled by fixed phrases | helper signal / shortcut | natural style intent -> answer_mode capability |
| memory policy | `core/MemoryPolicy.js` | memory triggers may rely on words | helper signal / policy | controlled memory write intent + confirmation |
| chat prompt heuristics | `src/bot/handlers/chat/chatPromptHeuristics.js` | prompt behavior depends on heuristics | helper signal | reduce to lightweight hints; model understands meaning |
| date intent | `src/core/time/currentDateIntent.js` | date request detection by phrases | helper signal | capability: time/date answer; keep as low-risk signal |
| project intent | `src/core/projectIntent/**` | many semantic/technical routes still phrase/regex-based | Technical Mode / transition layer | Living SG should use reasoning model + minimal controller |
| stage check | `src/bot/handlers/stage-check/**` | stage status by fixed patterns | Technical Mode | keep as diagnostic only |
| repo analysis | `src/bot/handlers/repoAnalyze.js` | question focus by keyword buckets | Technical Mode | natural repo analysis should use RepoStateAgent + AI reasoning |
| repo text filters | `src/repo/textFilters.js` | text filtering by terms | helper utility | allowed as utility, not intelligence |
| file/document session | `src/media/fileIntakeDocumentSession.js` | document state may use phrase flows | transition layer | move to capability-driven document intake later |

## 4.3 Phrase/regex logic that can stay temporarily

Allowed temporarily:
- command parsing;
- diagnostics;
- selftests;
- private/dev tools;
- safety filters;
- cheap pre-classification hints;
- compatibility with existing Telegram flows.

Not allowed as final Living SG:
- hardcoded phrase intent routing;
- large keyword maps pretending to understand user meaning;
- repo/workflow actions triggered only because a word appeared;
- state-changing actions from phrase match without permission/risk/confirmation.

---

# 5. Permission and policy risks

## 5.1 Current risk

The project currently has multiple access/policy maps:

```text
CMD_ACTION
PRIVATE_ONLY_COMMANDS
COMMAND_POLICIES
permissions.js
handler-level bypass checks
```

This creates possible drift.

## 5.2 Known drift examples

Commands routed by `dispatchTaskCommands.js` but missing from `CMD_ACTION`:

```text
/start_task
/stop_tasks_type
/stop_all_tasks
/stop_all
```

Commands routed by project repo dispatcher but not clearly present in all layers:

```text
/code_output_status
/project_intent_diag
```

## 5.3 Required future rule

```text
If a slash command exists in dispatcher, it must exist in a single command/capability policy registry.
```

Until this is done, commands should be considered legacy-risk.

---

# 6. Migration plan

## Step 1 — Document-only classification

Status: this file.

Goal:
- classify old command/runtime surfaces;
- mark fixed phrase/regex logic as Technical Mode/helper signal;
- avoid runtime changes.

## Step 2 — Create single command inventory source

Future file candidate:

```text
src/core/commandPolicy/commandInventory.js
```

Purpose:
- command;
- mode;
- capability;
- actionType: read/state-changing/external/costly;
- riskLevel;
- monarchOnly;
- privateOnly;
- requiresConfirmation;
- dispatcher;
- handler.

## Step 3 — Align `CMD_ACTION`, `PRIVATE_ONLY_COMMANDS`, `COMMAND_POLICIES`

Goal:
- no command exists only in dispatcher;
- no critical command lacks policy;
- no state-changing command runs without permission gate.

## Step 4 — Build Living SG controller boundary

Target flow:

```text
User message
-> reasoning model / meaning provider
-> minimal controller
   -> scope check
   -> capability check
   -> source/tool check
   -> action type check
   -> risk check
   -> confirmation if needed
-> response/action
```

## Step 5 — Move old phrase routes behind Technical Mode labels

Goal:
- no fixed phrase/regex route is described as Human Mode intelligence;
- phrase routes can remain only as helpers/fallback/diagnostics.

## Step 6 — Gradually expose capabilities naturally

Examples:

```text
"СГ, создай задачу проверять новости AI каждое утро"
-> task.create capability
-> cost/risk check
-> confirmation if needed
-> create task
```

```text
"СГ, проверь состояние проекта"
-> project.status capability
-> RepoStateAgent/source-first evidence
-> read-only response
```

---

# 7. Immediate recommendations

## 7.1 Do first

1. Keep this audit file as current migration map.
2. Create `commandInventory` skeleton or documentation table.
3. Add missing task commands to policy/action registry before touching behavior:
   - `/start_task`
   - `/stop_tasks_type`
   - `/stop_all_tasks`
   - `/stop_all`
4. Mark critical state-changing commands as requiring explicit confirmation.
5. Continue not treating commands as Living SG.

## 7.2 Do not do yet

Do not:
- delete old commands immediately;
- rewrite all `projectIntent` at once;
- build heavy semantic router;
- expose Human Mode runtime without gate;
- let fixed phrases trigger state-changing actions;
- mix user Personal SG with monarch project context.

---

# 8. Final audit conclusion

Current state:

```text
Runtime works.
New philosophy is documented.
Old command/phrase architecture still exists.
The project is in transition.
```

Required direction:

```text
Slash commands -> Technical Mode.
Fixed phrases / regex / keywords -> Technical Mode or helper signal.
Living SG -> meaning-first, capability-based, permission-gated, source-first.
```

This audit should be used before any runtime migration PR.
