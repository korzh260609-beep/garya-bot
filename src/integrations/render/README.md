# SG Render Integration

Render integration boundary for SG 2.0.

Purpose:
- isolate Render API configuration;
- normalize Render services, deploys, and logs before agents use them;
- protect secrets/env values from reports and AI output;
- provide a future read-only data source for DiagnosticsRenderAgent.

Current SG 2.0 status:
- skeleton only;
- no real Render API requests are performed yet;
- no runtime command runner is connected yet.

Rules:
- Render API key must never be returned to the model, Telegram, logs, reports, or workspace files;
- Render reads must be bounded by limits;
- Render writes/deploy actions are not part of this skeleton;
- DiagnosticsRenderAgent consumes normalized evidence only.
