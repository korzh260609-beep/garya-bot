# SG Render Workspace Reports

Controlled Render diagnostics reports for SG 2.0.

Purpose:
- expose selected Render deploy/log/status evidence to the Advisor chat;
- keep Render evidence separate from source code;
- make report files predictable and allowlisted.

Rules:
- do not store Render API keys, env values, tokens, or secrets here;
- logs must be clamped and sanitized by the DiagnosticsRenderAgent before writing;
- old reports must be reset before a new command run;
- report files are overwritten, not deleted.

Current SG 2.0 status:
- skeleton only;
- no Render API reads are connected yet.
