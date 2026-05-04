# Agent Workspace

Agent Workspace is the repo-based exchange channel between the Monarch, external ChatGPT work, and SG runtime.

Purpose:

```text
Monarch -> ChatGPT -> agent_workspace/COMMANDS.md
SG runtime -> reads command
SG runtime -> collects requested facts
SG runtime -> writes agent_workspace/*.md reports
ChatGPT or SG chat -> reads reports and analyzes only when asked
```

Rules:

- workspace stores facts and reports;
- workspace is not source code;
- workspace is not pillars;
- workspace is not memory by itself;
- collectors do not analyze logs;
- collectors do not call AI;
- collectors do not change Render state;
- collectors write only allowlisted workspace files.

Current role:

```text
exchange_channel_skeleton
```
