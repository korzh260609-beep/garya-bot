# RenderLogsCollector — Runtime Fact Collector

RenderLogsCollector is a read-only SG component.

Purpose:

```text
Collect Render deploys/status/logs on command and write factual reports into agent_workspace/.
```

Boundary:

- collects facts only;
- does not analyze logs;
- does not diagnose errors;
- does not call AI;
- does not change Render state;
- does not deploy;
- does not change source code;
- writes only allowlisted workspace markdown reports;
- stores a lightweight pointer to the latest result so SG chat can later read/analyze it when asked.

Allowed future actions:

```text
COLLECT_RENDER_DEPLOYS
COLLECT_RENDER_DEPLOY
COLLECT_RENDER_LOGS
COLLECT_RENDER_STATUS
```

Forbidden actions:

```text
ANALYZE
DIAGNOSE
FIX
DEPLOY
RESTART
DELETE
UPDATE_RENDER
```
