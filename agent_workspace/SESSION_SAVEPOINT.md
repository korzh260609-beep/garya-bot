# SESSION_SAVEPOINT

Checkpoint for current SG / Советник GARYA development block.

---

Saved at: `2026-04-28T15:20:00Z`
Saved by: `SG-advisor`
Scope: `RenderBridge raw logs by count + short Project Memory auto-restore boot logs`

---

## Current confirmed runtime

```text
Service: garya-bot
Render URL: https://garya-bot.onrender.com
Latest confirmed behavior: deploy completed; long pillars/sourceRef boot logs removed from Render Logs.
Verified by: Monarch visual check in Render dashboard + AgentWorkspace raw Render logs test.
```

## Important code commits in this block

```text
20fc7101b2b829cbe52bd2d3818b185ccd9e85ca
- Fixed AgentWorkspace diagnostic command parser.
- Diagnostic commands now keep full arguments, e.g. /render_bridge_logs latest 100.

e983d8cb9d8bd7a3a0c8a601d8787e3546130271
- Updated Telegram /render_bridge_logs handler to return RAW RENDER LOGS.
- Added support for requested log counts and deploy log modes.

37beb889d9302c95a6d2fb27134d788f41226aa9
- Synced AgentWorkspace diagnostic runner with raw Render logs logic.
- RUN_DIAGNOSTIC_COMMANDS can now capture raw logs in TEST_REPORT.md.

68d838639145df4fbb55d8486c9a1b873106d952
- Clarified Render log command modes in Telegram handler.
- Added modes for last logs, time-window logs, latest deploy logs, and specific deploy logs.

2635de6fd07de262d636fca2591ce129b2c3e4d9
- Synced diagnostic runner with the clarified Render log modes.

4031cac7088dfa2611e7b21768ee75cf958881f4
- Added RenderBridge.listLogsByCount().
- Count-based log retrieval no longer requires explicit startTime/endTime from SG commands.

ed2356190add65519a8f91784540f085e1ffe374
- Telegram /render_bridge_logs now uses listLogsByCount() for latest_count mode.
- Output marks timeFilter=none for count-based logs.

b000e0bbfbf3f3a80be41ef00f7d41956377505f
- AgentWorkspaceDiagnosticExecutor now uses listLogsByCount() for count-based logs.
- COMMANDS.md /render_bridge_logs 50 returns requested count with timeFilter=none.

d843cc1a8e5b867665b024baaffef825ca3219b8
- Shortened Project Memory auto-restore boot logs.
- Replaced verbose sourceRef/pillars dump with summarizeProjectMemoryAutoRestore().
```

## Verified behavior

### Render raw logs by count

```text
COMMAND_ID: RAW-RENDER-LAST-50-COUNT-001
STATUS: DONE
ACTION: RUN_DIAGNOSTIC_COMMANDS
Payload: /render_bridge_logs 50
Runtime commit: b000e0bbfbf3f3a80be41ef00f7d41956377505f
Diagnostics OK: 1
Diagnostics failed: 0
```

Observed TEST_REPORT output:

```text
✅ RAW RENDER LOGS
mode=last_logs_by_count
target=latest_count
timeFilter=none
windowMinutes=-
requested=50
returned=50
```

Meaning:
- SG can return raw Render logs for analysis.
- `/render_bridge_logs 50` means last 50 logs by count.
- The command is not interpreted as “50 minutes”.
- The report captures raw log lines, not SG analysis.

### Render deploy list

Previously verified:

```text
/render_bridge_deploys 5
```

Meaning:
- SG can return the requested count of Render deploys.
- Deploy list includes deployId, status, createdAt, finishedAt, commit.

### Latest/specific deploy log modes

Supported command modes:

```text
/render_bridge_logs 50
/render_bridge_logs 100
/render_bridge_logs time 60 100
/render_bridge_logs 60m 100
/render_bridge_logs latest_deploy 50
/render_bridge_logs deploy <deployId> 50
```

Meaning:
- Count mode is primary for ordinary log requests.
- Time-window mode is explicit only when requested.
- Latest deploy and specific deploy logs remain available.

### Short Project Memory auto-restore logs

After deploy of commit:

```text
d843cc1a8e5b867665b024baaffef825ca3219b8
```

Monarch confirmed in Render dashboard:

```text
Long pillars/sourceRef boot logs are gone.
```

Expected boot log format now:

```text
🧩 Project Memory auto-restore: {
  ok: true,
  checked: <n>,
  synced: <n>,
  alreadyExists: <n>,
  skipped: <n>,
  sections: "architecture, misc, project, roadmap, workflow"
}
```

Meaning:
- Project Memory auto-restore still runs.
- It still protects existing sections from overwrite.
- It no longer pollutes Render logs with long `pillars/...` sourceRef lists.

## Current log interpretation

Recent 50 raw Render logs showed:

```text
Detected service running on port 10000
Available at your primary URL https://garya-bot.onrender.com
Your service is live 🎉
Telegram webhook already installed / skipped
Sources registry ready
ROBOT mock-layer started
Access Requests table OK
```

Meaning:
- No critical runtime error was visible in the checked log window.
- Boot path is healthy.
- Logs are now usable for human/ChatGPT analysis.

## Current rules confirmed

```text
/render_bridge_logs N
=> return last N raw logs by count
=> no SG analysis
=> no time-window semantics unless explicitly requested

/render_bridge_logs time MINUTES LIMIT
=> return LIMIT raw logs from explicit time window

/render_bridge_logs latest_deploy LIMIT
=> return raw logs from latest deploy window

/render_bridge_logs deploy DEPLOY_ID LIMIT
=> return raw logs from a specific deploy window
```

## Warnings

- Render API may still internally apply its own defaults/pagination, but SG command semantics are count-first.
- Count mode is verified for 50 logs.
- Test 100 logs separately before relying on it for large diagnostics.
- Keep Project Memory auto-restore summary short; do not reintroduce full `sourceRef` dumps into boot logs.
- Do not move `agent_workspace/` without changing AgentWorkspace config.
- Do not move `src/` files without updating imports.
- `pillars/` can be reorganized more safely because PillarsResolver scans it recursively, but project memory overwrite still requires explicit approval.

## Current completed block

```text
RenderBridge raw log delivery and Render boot log cleanup are complete.
```

## Next recommended step

```text
Run a final smoke test after the latest deploy:
/render_bridge_logs 50
```

Expected:

```text
timeFilter=none
requested=50
returned=50
No long pillars/sourceRef dump
No critical runtime errors
```

Then make a Render snapshot/backup for rollback.

---

# SESSION_SAVEPOINT — Living SG Core CI Coverage

Saved at: `2026-05-01T13:41:49Z`
Saved by: `SG-advisor`
Scope: `Living SG behavior core + systemPrompt smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Safe transition of SG to Living SG behavior.
Current focus: Global Living SG behavior first, not separate function wiring.
```

## Confirmed principles for this block

```text
message
→ conversation context
→ meaning
→ intent
→ capability need
→ permission/gate
→ source/tool if actually available
→ answer/action
```

Forbidden during this block:

```text
- no keyword/phrase-router intelligence
- no костыльная логика
- no premature repo-read runtime
- no executor
- no repo write without explicit monarch permission
- no deploy actions
- no memory changes from Living SG
- no Technical Mode expansion
- no diagnostic bridge expansion
- no new slash commands unless explicitly approved
```

## Important commits in this Living SG block

```text
e90356eb16c38aa030808a113afb84878c883c8f
- Removed premature Human Mode repo-read runtime wiring.

8cac7c680488e263d585cc534d4974a7a98ea3e4
- Added Living SG core behavior to BehaviorCore.

e0bf035cb6b04a338de7dd08e623c0325ce9fbd3
- Added scripts/smokeLivingSGCoreBehavior.js.

6ae1c77663540378a959ea7580d80f168ba0f16b
- Added package.json script: smoke:living-sg-core.

ad99cfd692e7ba8ada260d91cf96e80f988affb2
- Added .github/workflows/smoke-living-sg-core.yml.

705e8274b0135a33a01d1c36516571ce7f497f12
- Added scripts/smokeSystemPromptLivingSGCore.js.

9ad2cd2bb341e2839d86ab245d2773f870a61b99
- Added package.json script: smoke:system-prompt-living-sg.

0f10843ee63d30ed7fe90976ba850ec8c26e37d7
- Added .github/workflows/smoke-system-prompt-living-sg.yml.
```

## Verified CI behavior

Monarch visually confirmed in GitHub Actions:

```text
Smoke System Prompt Living SG #1: passed
SG Minimal CI #5744: passed
Branch: main
Commit: 0f10843...
```

Meaning:
- Living SG core behavior smoke is covered by GitHub Actions.
- systemPrompt Living SG smoke is covered by GitHub Actions.
- The new workflow runs npm run smoke:system-prompt-living-sg.
- The smoke coverage checks behavior/prompt wiring only.
- It does not connect repo/tool capabilities.
- It does not connect RepoStateAgent runtime.
- It does not add Human Meaning Provider.
- It does not modify memory.

## Current completed microstep

```text
GitHub Actions coverage for systemPrompt Living SG smoke test is complete.
```

## Next safe microstep

```text
Continue Living SG behavior stability checks without connecting repo-read runtime.
```

Recommended next check:

```text
Review whether current Living SG prompt wording is strong enough against:
- keyword/phrase-router fallback;
- fake source access;
- premature capability simulation;
- Technical Mode leakage;
- component/tool being treated as separate SG.
```

## Warnings

- Do not return to repo-read capability yet.
- Do not add Human Meaning Provider yet.
- Do not connect RepoStateAgent runtime yet.
- Do not implement functions before Living SG behavior is stable.
- Do not mark pillar roadmap items as done manually; use repo/runtime/tests or generated status snapshots as evidence.
