# SG Agent Workspace

Controlled workspace for SG operational exchange.

Purpose:
- receive approved commands from the Monarch/Advisor flow;
- expose SG runtime diagnostic reports back to the Advisor chat;
- keep Render logs/deploy reports separate from source code;
- avoid mixing old report data with new command results.

Rules:
- this workspace is not source code;
- SG must not store secrets, env values, API keys, tokens, or private raw dumps here;
- SG must only update allowlisted workspace report files;
- COMMANDS.md is the command handoff file and must not be auto-cleared;
- reports must be reset before every new command run by the workspace cleaner.

Current SG 2.0 status:
- workspace skeleton exists;
- RenderAgent read-only command routing is connected through `AgentWorkspaceCommandRunner`;
- Render env/status, logs, deploys, and deploy details actions are available as workspace commands;
- runtime auto-execution may still be disabled until runtime hooks are explicitly wired/enabled;
- Render writes/deploy actions are not supported.
