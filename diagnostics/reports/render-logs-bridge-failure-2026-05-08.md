# Diagnostic Report: Render Logs Bridge Failure

Date: 2026-05-08
Branch: dev/v2-start
Commit observed: b879848a45c9328a67e0d3dfdc0f4180e77dc838
Post-diagnostics workspace commit: 998b77a8d1ec00e0e0ca7d327e845fea1e0daadd
Status: OPEN

---

## Problem

SG can receive the Monarch command to collect Render logs, but the Render logs collection does not currently update:

```text
runtime/render/latest/latest-render-logs.json
```

After PR #138, SG no longer crashes on runtime tool failure. Instead, it returns a normal Telegram response with a tool failure explanation.

---

## Observed behavior

Telegram command tested by the Monarch:

```text
СГ, возьми 100 логов Render
```

Before PR #138:

```text
SG returned generic fallback:
Я не смог обработать сообщение. Нужно проверить внутреннее состояние SG.
```

After PR #138:

```text
SG returned a normal diagnostic error instead of crashing.
The visible meaning of the error: Render logs could not be collected because the Render API request failed.
```

The latest stored log report remained old:

```text
generated_at: 2026-05-08T06:52:53.385Z
limit: 30
```

---

## Expected behavior

When the Monarch asks for Render logs:

```text
СГ, возьми 100 логов Render
```

SG should:

```text
1. call render_collect_logs
2. collect fresh Render logs
3. write sanitized data to runtime/render/latest/latest-render-logs.json
4. answer in Telegram with a short result summary
```

---

## Evidence

Relevant runtime/code facts:

```text
PR #138 fixed fatal tool execution behavior.
File: src/ai/aiToolRunner.js
Change: runtime tool exceptions are converted into structured tool results.
```

Current Render bridge config reads:

```text
RENDER_BRIDGE_ENABLED
RENDER_API_KEY
RENDER_API_BASE_URL
RENDER_BRIDGE_TIMEOUT_MS
RENDER_BRIDGE_DEFAULT_SOURCE_KEY
RENDER_BRIDGE_DEFAULT_LOG_LEVEL
RENDER_BRIDGE_DEFAULT_LOG_WINDOW_MINUTES
RENDER_BRIDGE_DEFAULT_LOG_LIMIT
RENDER_BRIDGE_DEFAULT_DEPLOY_LIMIT
```

Important: no raw env values or API keys are stored in this report.

---

## Likely cause

The exact root cause is not confirmed yet.

Possible causes:

```text
1. Render API key is valid for some endpoints but not for /logs.
2. Render API /logs endpoint query parameters are wrong or outdated.
3. Render API changed expected logs filtering format.
4. SG error text is currently too summarized to distinguish 400 vs 401 vs 403 precisely.
```

Do not assume the API key is bad without the raw safe error code.

---

## Risk

The current failure affects diagnostics only:

```text
- Render logs collection may fail.
- SG Telegram chat should not crash after PR #138.
- Other runtime tools should now return structured failures instead of fatal fallback.
```

---

## Fix plan

Next recommended PR:

```text
fix: expose render logs raw error safely
```

Minimal change target:

```text
src/integrations/render/renderBridgeClient.js
or the Render logs task boundary
```

Goal:

```text
Return safe structured error fields:
- endpoint
- HTTP status code
- Render error message, masked/truncated
- selected fallback attempt label
- whether failure was auth, permission, bad request, timeout, or unknown
```

Forbidden:

```text
- exposing RENDER_API_KEY
- exposing raw env values
- changing Render state
- adding deploy/restart actions
- hiding the exact error behind vague AI wording
```

---

## Verification plan

After the safe raw error PR:

```text
1. Deploy dev/v2-start to Render.
2. In Telegram: СГ, возьми 100 логов Render
3. Confirm Telegram does not show generic fallback.
4. Confirm SG reports exact safe error category if failure continues.
5. If success, confirm runtime/render/latest/latest-render-logs.json has a fresh generated_at timestamp.
```

---

## Current status

```text
OPEN — needs safe raw error diagnostics before changing Render API key or query strategy.
```
