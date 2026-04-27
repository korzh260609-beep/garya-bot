# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-full-runtime-check-2`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T17:10:00.660Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test command

```text
RUN_REPO_STATE_AGENT
```

## Result

- `REPO_STATE_AGENT_OK`

## Technical map

```text
ok: yes
persisted: yes
repo: korzh260609-beep/garya-bot
branch: main
files: 954
modules: 67
dependencies: 776
projectMap: yes
projectMapModules: 67
projectMapLinks: 72
scanRunId: 6
error: -
```

## Semantic AI map

```text
aiEnabled: no
aiSkipped: yes
aiReused: no
aiReason: first_analysis
shouldAnalyze: yes
signatureLength: 125861
hasAnalysis: no
```

## Raw compact

```json
{
  "ok": true,
  "persisted": true,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 954,
  "modulesCount": 67,
  "dependenciesCount": 776,
  "scanRunId": 6,
  "aiAnalysis": {
    "enabled": false,
    "skipped": true,
    "reason": "first_analysis"
  },
  "aiMeta": {
    "shouldAnalyze": true,
    "reason": "first_analysis",
    "projectMapSignature": "{\"commandLikeFiles\":[{\"extension\":\".md\",\"layer\":\"other\",\"moduleKey\":\"agent_workspace\",\"path\":\"agent_workspace/COMMANDS.md\",\"size\":1265},{\"extension\":\".md\",\"layer\":\"other\",\"moduleKey\":\"agent_workspace\",\"path\":\"agent_workspace/DIAGNOSIS.md\",\"size\":201},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/roles.js\",\"size\":3323},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/structure.js\",\"size\":1306},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/diagnostics.js\",\"size\":657},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/report.js\",\"size\":917},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"docs\",\"path\":\"docs/legacy/commands.legacy.js\",\"size\":39997},{\"extension\":\".js\",\"layer\":\"entrypoint\",\"moduleKey\":\"index.js\",\"path\":\"index.js\",\"size\":5146},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/013_chat_messages_user_idempotency_index.js\",\"size\":1601},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/031_command_invocations_table.js\",\"size\":1421},{\"extension\":\".js\",\"layer\":\"agent_workspace\",\"moduleKey\":\"src/agentWorkspace\",\"path\":\"src/agentWorkspace/AgentWorkspaceChaosDiagFormatter.js\",\"size\":2046},{\"extension\":\".js\",\"layer\":\"agent_workspace\",\"moduleKey\":\"src/agentWorkspace\",\"path\":\"src/agentWorkspace/AgentWorkspaceChatCommandExecutor.js\",\"size\":24630},{\"extension\":\".js\",\"layer\":\"agent_workspace\",\"moduleKey\":\"src/agentWorkspace\",\"path\":\"src/agentWorkspace/AgentWorkspaceCommandParser.js\",\"size\":3945},{\"extension\":\".js\",\"layer\":\"agent_workspace\",\"moduleKey\":\"src/agentWorkspace\",\"path\":\"src/agentWorkspace/AgentWorkspaceCommandRunner.js\",\"size\":31552},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commandDispatcher.js\",\"size\":12155},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commands.js\",\"size\":964},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/constants/privateOnlyCommands.js\",\"size\":3017},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicyCoverage.js\",\"size\":2756},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicySelfTest.js\",\"size\":4891},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/intentActionRouterSelfTest.js\",\"size\":6221},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentBoundarySelfTest.js\",\"size\":7127},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentRouterIntegrationSelfTest.js\",\"size\":7449},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchAgentWorkspaceCommands.js\",\"size\":1454},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCapabilitiesCommands.js\",\"size\":1427},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCryptoDevCommands.js\",\"size\":4470},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js\",\"size\":2111},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js\",\"size\":10362},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchIdentityCommands.js\",\"size\":6090},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchLegacyLocalCommands.js\",\"size\":995},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js\",\"size\":17432},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMetaDebugCommands.js\",\"size\":2222},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchPriceCommands.js\",\"size\":993},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProfileModeCommands.js\",\"size\":982},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js\",\"size\":11498},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryCommands.js\",\"size\":1457},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryConfirmedCommands.js\",\"size\":5078},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemorySessionCommands.js\",\"size\":4833},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/d…
```
