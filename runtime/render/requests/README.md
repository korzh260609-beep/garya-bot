# Render Requests

This folder stores request files for Render diagnostics.

V1 allowed request types:
- render_logs
- render_deploys
- render_latest_deploy_logs
- render_env_summary
- render_status

Rules:
- one request equals one file;
- request data must not contain secrets;
- request status starts as requested;
- processing is explicit and request-driven;
- no polling-by-default.
