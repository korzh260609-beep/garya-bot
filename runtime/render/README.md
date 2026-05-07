# Render Runtime Workspace

This folder is the official GitHub request/response workspace for SG 2.0 Render diagnostics.

Purpose:
- store Render diagnostic requests from the Monarch/Advisor side;
- store sanitized Render diagnostic responses from SG runtime;
- avoid direct secret exposure;
- keep Render telemetry separate from SG core, Telegram transport, AI layer, and GitHub tool logic.

Rules:
- read-only Render data only;
- no Render env values;
- env variables may be reported only as SET/MISSING;
- no deploy/restart/env mutation commands in V1;
- no Agent Workspace runtime revival;
- no polling requirement in this folder;
- request processing must be explicit and request-driven.

Structure:

```text
runtime/render/
  requests/
  responses/
  latest/
```

Status:
- skeleton only;
- no request processor is connected yet;
- no automatic execution is connected yet.
