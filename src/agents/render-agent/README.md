# RenderAgent

Simple SG agent for Render diagnostics.

Responsibility:
- Render status diagnostics;
- Render logs;
- Render deploys;
- Render deploy details;
- Render env readiness diagnostics without exposing secret values.

Rules:
- no GitHub Actions logic here;
- no PR/check logic here;
- no Telegram flow here;
- no DB or AI calls here;
- no Render write/deploy actions here;
- keep this agent simple and bounded.

Current status:
- compatibility wrapper around the existing DiagnosticsRenderAgent implementation;
- old path remains temporarily for safe migration.
