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
- skeleton only;
- no runtime command runner is connected yet;
- no Render API reads are connected yet.
