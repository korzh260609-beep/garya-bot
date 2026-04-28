# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-force-ai-dry-run-16`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T06:46:36.836Z`
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
files: 961
modules: 67
dependencies: 782
projectMap: yes
projectMapModules: 67
projectMapLinks: 72
scanRunId: 18
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: yes
aiReused: no
aiReason: repo_state_agent_prompt_too_large
shouldAnalyze: no
aiForceAnalysis: yes
originalShouldAnalyze: no
promptChars: 131345
signatureLength: 24491
hasAnalysis: no
```

## Raw compact

```json
{
  "ok": true,
  "persisted": true,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 961,
  "modulesCount": 67,
  "dependenciesCount": 782,
  "scanRunId": 18,
  "aiAnalysis": {
    "enabled": true,
    "skipped": true,
    "reason": "repo_state_agent_prompt_too_large",
    "promptChars": 131345,
    "maxPromptChars": 30000,
    "forceAiAnalysis": true,
    "originalShouldAnalyze": false
  },
  "aiMeta": {
    "shouldAnalyze": false,
    "reason": "project_map_unchanged",
    "projectMapSignature": "{\"commandLikeFiles\":[{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/013_chat_messages_user_idempotency_index.js\"},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/031_command_invocations_table.js\"},{\"extension\":\".js\",\"layer\":\"entrypoint\",\"moduleKey\":\"index.js\",\"path\":\"index.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/roles.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/structure.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/diagnostics.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/report.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"docs\",\"path\":\"docs/legacy/commands.legacy.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commandDispatcher.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/constants/privateOnlyCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicyCoverage.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/intentActionRouterSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentBoundarySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentRouterIntegrationSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchAgentWorkspaceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCapabilitiesCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCryptoDevCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchIdentityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchLegacyLocalCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMetaDebugCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchPriceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProfileModeCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryConfirmedCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemorySessionCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectRepoCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchRecallCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchRenderBridgeCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchSourcesCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchSystemInfoCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchTaskCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/handlers/agentWorkspaceDiag.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/handlers/agentWorkspaceRenderReport.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/handlers/agentWorkspaceRun.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/handlers/agentWorkspaceTestNote.js\"},{\"extension\"…
```
