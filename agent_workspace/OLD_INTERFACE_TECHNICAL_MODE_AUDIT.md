# OLD_INTERFACE_TECHNICAL_MODE_AUDIT

Audit for hard separation of SG interface modes.

Created after verification of:
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/REPOINDEX.md`
- rollback branch: `rollback/snapshot-before-hard-interface-split-20260428-2212`

---

## Scope

This audit lists old command, phrase, keyword, regex and legacy routing surfaces that must be treated as Technical Mode unless a verified Human Mode replacement is built later.

No runtime behavior is changed by this document.
No old code is deleted by this document.

---

## Governing rule

Human Mode:
- normal SG conversation by meaning;
- must use context, role, permissions and capability selection;
- for factual repo/project state must use `RepoStateAgent`.

Technical Mode:
- slash commands;
- exact phrase routes;
- exact word routes;
- regex/keyword routes;
- debug commands;
- legacy repo commands;
- AgentWorkspace commands;
- Render/GitHub diagnostics.

Hard rule:

```text
old slash/word/phrase/regex logic = Technical Mode
```

Do not mix with Human Mode.
Do not convert old phrase routes into weak semantic signals at this stage.

---

## Audit categories

- Technical Mode only
- Human Mode candidate later
- RepoStateAgent-backed replacement needed
- Keep temporarily
- Remove later only after verified replacement

---

## 1. Central slash command dispatcher

### File

`src/bot/commandDispatcher.js`

### Finding

This file accepts only slash commands:

```js
if (typeof cmd !== "string" || !cmd.startsWith("/")) {
  return { handled: false };
}
```

It then routes through many `dispatch*Commands` blocks.

### Classification

Technical Mode only.

### Action

Keep temporarily.
Do not delete.
Do not present as Human Mode intelligence.

---

## 2. Project/repo legacy commands

### File

`src/bot/dispatchers/dispatchProjectRepoCommands.js`

### Commands found

- `/reindex`
- `/repo_status`
- `/repo_tree`
- `/repo_file`
- `/repo_analyze`
- `/repo_diff`
- `/repo_search`
- `/repo_get`
- `/repo_check`
- `/repo_review`
- `/repo_review2`
- `/code_output_status`
- `/project_intent_diag`
- `/workflow_check`
- `/stage_check`

### Classification

Technical Mode only.
RepoStateAgent-backed replacement needed for factual repo/project state answers.

### Risk

Old repo commands may rely on old repo/index mechanisms or old file grouping.
They must not be treated as current factual project truth.

### Action

Keep temporarily for diagnostics/backward compatibility.
Later adapt to RepoStateAgent or remove only after verified replacement.

---

## 3. Command policy layer

### File

`src/core/commandPolicy/commandPolicies.js`

### Finding

The policy layer already groups slash commands by scope:

- project memory
- project repo
- memory diagnostics
- sources
- system
- dev

It also states that slash commands are explicit system/admin/diagnostic controls and normal SG conversation must remain natural-language driven.

### Classification

Technical Mode only.
Keep temporarily.

### Action

Use as support for Technical Mode boundaries.
Do not use it as Human Mode semantic routing.

---

## 4. AgentWorkspace commands

### Files

`src/bot/dispatchers/dispatchAgentWorkspaceCommands.js`
`src/agentWorkspace/AgentWorkspaceCommandParser.js`

### Commands found

Slash commands:

- `/agent_workspace_diag`
- `/agent_workspace_run`
- `/agent_workspace_render_report`
- `/agent_workspace_test_note`

Markdown command actions:

- `VERIFY_DEPLOY`
- `COLLECT_RENDER_REPORT`
- `COLLECT_RENDER_LOGS`
- `COLLECT_RENDER_DEPLOYS`
- `COLLECT_RENDER_DEPLOY`
- `COLLECT_RENDER_STATUS`
- `WRITE_TEST_NOTE`
- `RUN_DIAGNOSTIC_COMMANDS`
- `RUN_REPO_STATE_SCAN`
- `RUN_REPO_STATE_AGENT`
- `RUN_REPO_STATE_AGENT_REAL_AI`

### Classification

Technical Mode only.
Keep temporarily.

### Action

Keep as controlled command/report bridge.
Do not expose as normal Human Mode path.

---

## 5. Render bridge commands

### File

`src/bot/dispatchers/dispatchRenderBridgeCommands.js`

### Commands found

- `/render_bridge_service`
- `/render_bridge_services`
- `/render_bridge_errors`
- `/render_bridge_logs`
- `/render_bridge_diagnose`
- `/render_bridge_deploys`
- `/render_bridge_deploy`
- `/render_bridge_diag`

### Classification

Technical Mode only.
Keep temporarily.

### Action

Keep for diagnostics/ops.
Do not mix with Human Mode.

---

## 6. Decision diagnostics commands

### File

`src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js`

### Commands found

- `/diag_decision`
- `/diag_decision_last`
- `/diag_decision_stats`
- `/diag_decision_db_stats`
- `/diag_decision_last_db`
- `/diag_decision_window`
- `/diag_decision_promotion`

### Classification

Technical Mode only.
Keep temporarily.

### Action

Keep as diagnostics.
Do not use as normal user-facing Human Mode behavior.

---

## 7. ProjectIntent semantic alias matching

### File

`src/core/projectIntent/semantic/projectIntentSemanticAliases.js`

### Finding

Uses phrase/keyword checks through `normalized.includes(...)`, for example:

- `что это за проект`
- `about project`
- `readme`
- `decision`
- `решени`
- `workflow`
- `roadmap`
- `project.md`

### Classification

Technical Mode / legacy phrase-bound routing for now.
Human Mode candidate later only after separate meaning layer is built.

### Risk

This looks semantic but is still phrase/keyword-bound.
Under hard separation it must not be treated as full Human Mode.

### Action

Keep temporarily.
Do not expand with new phrase hacks.
Do not use as factual repo truth.

---

## 8. ProjectIntent read-plan signal collectors

### File

`src/core/projectIntent/readPlan/projectIntentReadPlanSignals.js`

### Finding

Provides generic phrase/token/prefix collectors:

- `collectPhraseHits(...)`
- `collectTokenHits(...)`
- `collectPrefixHits(...)`

### Classification

Technical Mode support / legacy signal infrastructure for now.
Human Mode candidate later only if driven by a real structured meaning layer.

### Action

Keep temporarily.
Do not use as Human Mode by itself.

---

## 9. ProjectIntent semantic intent detector

### Files

`src/core/projectIntent/semantic/projectIntentSemanticIntentDetector.js`
`src/core/projectIntent/semantic/projectIntentSemanticConstants.js`

### Finding

Detects intents from prefix arrays and exact/partial text checks:

- search/open/explain/translate/summary/tree/status prefixes
- continuation/follow-up prefixes
- folder/file/listing prefixes
- `normalized.includes(...)` checks such as `дерево репозитория`, `какие папки в корне`, `видишь репозиторий`, `есть доступ к репозиторию`, `что это за файл`, `в чем смысл`, etc.

### Classification

Technical Mode / legacy semantic-looking phrase router for now.
RepoStateAgent-backed replacement needed for repo/project state answers.

### Risk

This can be mistaken for Human Mode because it uses natural phrases.
But it is still deterministic phrase/prefix routing.

### Action

Keep temporarily.
Do not add more phrase-bound behavior.
Do not connect it as the main Human Mode router.

---

## 10. Project Diagnostic Natural Bridge

### File

`src/core/projectIntent/projectDiagnosticNaturalBridge.js`

### Finding

Purpose is directionally correct:

- user speaks normal language;
- SG calls RepoStateAgent;
- reply is human-readable;
- no slash command dependency;
- no Telegram dependency;
- no real AI spending;
- no repo writes;
- no pillars edits.

But it still depends on route/match signals from the existing projectIntent layer.

### Classification

Keep temporarily.
Human Mode candidate later.
RepoStateAgent-backed replacement needed.

### Risk

If route/match signals are phrase-bound, this bridge may accidentally mix Human Mode and old phrase routing.

### Action

Do not delete.
Do not expand phrase matching.
Later rebuild/attach through a clean Human Mode meaning boundary.

---

## 11. IntentActionRouter and MeaningIntentBoundary

### Files

`src/core/intentAction/IntentActionRouter.js`
`src/core/meaningIntent/MeaningIntentBoundary.js`

### Finding

These files explicitly avoid raw text parsing and phrase matching.
They are skeletons for future structured intent routing.

### Classification

Human Mode candidate later.
Keep.

### Action

Do not connect globally yet.
Do not build full SemanticRouter now.
Use later after old Technical Mode surfaces are isolated.

---

## Initial decision table

| Surface | Category | Decision |
| --- | --- | --- |
| `commandDispatcher.js` slash routing | Technical Mode only | keep temporarily |
| `dispatchProjectRepoCommands.js` | Technical Mode only | replace factual repo answers with RepoStateAgent later |
| `commandPolicies.js` | Technical Mode policy support | keep |
| AgentWorkspace slash/actions | Technical Mode only | keep as controlled bridge |
| Render bridge commands | Technical Mode only | keep |
| Decision diagnostics commands | Technical Mode only | keep |
| ProjectIntent semantic aliases | phrase-bound legacy | keep temporarily, no expansion |
| ProjectIntent read-plan collectors | phrase/token/prefix support | keep temporarily, no Human Mode claim |
| ProjectIntent semantic intent detector | semantic-looking phrase router | keep temporarily, no expansion |
| ProjectDiagnosticNaturalBridge | Human Mode candidate later | keep, do not expand phrase layer |
| MeaningIntentBoundary / IntentActionRouter | future Human Mode skeleton | keep, do not globally connect yet |

---

## Required next step

Create an explicit Technical Mode registry/labeling layer later, without changing command behavior first.

Suggested next safe step:

1. Add comments/metadata only where needed.
2. Mark old slash/phrase/regex routers as Technical Mode.
3. Keep runtime unchanged.
4. Then plan a clean Human Mode capability path using structured meaning + RepoStateAgent.

---

## Hard warnings

- Do not use old `REPOINDEX.md` as current truth.
- Do not use old RepoIndexService grouping as current truth.
- Do not add new phrase-bound hacks.
- Do not build global SemanticRouter yet.
- Do not delete old code now.
- Do not mix Human Mode and Technical Mode.
- Do not convert old phrase routes into weak semantic signals at this stage.
