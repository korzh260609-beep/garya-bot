# Render Syslog Collector Setup

## What this is

This collector accepts **Render Log Streams** over **TLS syslog** and forwards snapshots into SG:

Render Log Stream  
→ syslog collector  
→ `POST /ingest/render-log`  
→ PostgreSQL  
→ Telegram commands

## Important limitation

This collector is **not** a normal HTTP route.

It needs a hosting target that supports:

- inbound TCP port
- TLS certificate for that port
- long-running Node.js process

Because of that, it may **not** fit inside the current `garya-bot` web service as-is.

## Required environment variables

### Forwarding to SG
- `RENDER_LOG_INGEST_URL`
- `RENDER_LOG_INGEST_TOKEN`

### TLS listener
- `SYSLOG_TLS_CERT_PEM` or `SYSLOG_TLS_CERT_BASE64`
- `SYSLOG_TLS_KEY_PEM` or `SYSLOG_TLS_KEY_BASE64`

## Optional environment variables
- `SYSLOG_TLS_PORT=6514`
- `SYSLOG_TLS_HOST=0.0.0.0`
- `SYSLOG_TLS_CA_PEM`
- `SYSLOG_TLS_CA_BASE64`
- `COLLECTOR_SOURCE_KEY=render_primary`
- `COLLECTOR_IDLE_FLUSH_MS=2500`
- `COLLECTOR_MAX_BUFFER_CHARS=32000`
- `COLLECTOR_DEDUPE_WINDOW_MS=180000`
- `COLLECTOR_FORWARD_NON_ERRORS=false`

## What to configure in Render Log Streams

When Render asks for a **TLS-enabled syslog endpoint**, you should provide:

- host = your collector host
- port = your collector TCP TLS port (default 6514)

Example target:
- host: `logs.example.com`
- port: `6514`

This is **not** the same thing as:
- `https://garya-bot.onrender.com`
- `/ingest/render-log`

`/ingest/render-log` is the **downstream HTTP receiver inside SG**, not the external syslog endpoint for Render.

## Current behavior

The collector uses heuristics:

### deploy failed
Triggers deploy snapshot when text contains markers like:
- `Build failed`
- `Deploy failed`
- `SyntaxError:`
- `Exited with status`

### deploy success
Triggers deploy snapshot when text contains markers like:
- `Available at your primary URL`
- `Live`
- `Deploy complete`

### error
Triggers error snapshot when text contains markers like:
- `SyntaxError:`
- `TypeError:`
- `ReferenceError:`
- `Exception`
- `Fatal`

## Expected final flow

1. Deploy collector on a platform that supports inbound TLS TCP
2. Give Render Log Streams the collector host and port
3. Collector forwards snapshots to:
   - `RENDER_LOG_INGEST_URL`
4. Check in Telegram:
   - `/render_errors_last`
   - `/render_deploys_last`