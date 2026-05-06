# SG Render Workspace Reports

Controlled Render diagnostics reports for SG 2.0.

Purpose:
- expose selected Render env/status, deploy, and log evidence to the Advisor chat;
- keep Render evidence separate from source code;
- make report files predictable and allowlisted.

Rules:
- do not store Render API keys, env values, tokens, or secrets here;
- logs must be clamped and sanitized before writing;
- old reports must be reset before a new command run;
- report files are overwritten, not deleted.

Allowlisted Render reports:
- `RENDER_ENV_STATUS_REPORT.md`
- `RENDER_LOGS_REPORT.md`
- `RENDER_DEPLOYS_REPORT.md`
- `RENDER_DEPLOY_REPORT.md`
- `RENDER_STATUS_REPORT.md`

Current SG 2.0 status:
- RenderAgent read-only command routing is connected through `AgentWorkspaceCommandRunner`;
- Render env/status, logs, deploys, and deploy details actions are available as workspace commands;
- runtime auto-execution may still be disabled until runtime hooks are explicitly wired/enabled;
- Render writes/deploy actions are not supported.
