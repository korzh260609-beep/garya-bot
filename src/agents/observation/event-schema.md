# Observation Event Schema V1

## Purpose

This document defines the minimal sanitized event format for SG Observation Agents.

The schema exists so future observer agents can record what happened without becoming complex autonomous systems.

V1 is a contract only. It does not connect Telegram, tools, memory, or runtime writes yet.

## Core rule

```text
observation event = sanitized fact, not raw transcript
```

Observation events must be small, safe, and useful for diagnostics.

## Event flow

```text
raw system event
  -> sanitizer
  -> ObservationEvent V1
  -> latest runtime report / future short-term store
  -> diagnostics / supervisor summary
  -> optional memory candidate
```

## Required top-level fields

```json
{
  "schema_version": 1,
  "event_id": "optional-stable-id",
  "event_type": "transport.message",
  "created_at": "2026-05-09T00:00:00.000Z",
  "source": {},
  "actor": {},
  "direction": "inbound",
  "summary": "short sanitized summary",
  "payload": {},
  "tool": null,
  "policy": {},
  "links": {}
}
```

## Event types

```text
transport.message      user/SG message event
transport.delivery     delivery success/failure
tool.call              tool call started/requested
tool.result            tool call result/failed
runtime.status         runtime or infrastructure status
diagnostics.result     diagnostics report result
conversation.audit     quality/rule audit result
supervisor.note        supervisor summary or recommendation
```

## Directions

```text
inbound   user -> SG
outbound  SG -> user
internal  SG/internal agent/system event
```

## Source object

```json
{
  "system": "sg",
  "transport": "telegram",
  "module": "transport-observer"
}
```

Rules:

- `system` is usually `sg`.
- `transport` may be `telegram`, `web`, `api`, `github`, `render`, or `unknown`.
- `module` identifies the observer or source module.

## Actor object

```json
{
  "role": "monarch",
  "user_ref": "redacted-or-hash",
  "chat_ref": "redacted-or-hash"
}
```

Allowed roles:

```text
monarch
citizen
guest
system
unknown
```

Rules:

- V1 starts with the Monarch only.
- Raw Telegram user IDs and chat IDs must not be stored by default.
- Use redacted or hashed references.

## Payload object

Payload must stay compact and sanitized.

Examples:

```json
{
  "text_preview": "СГ, проверь состояние проекта после деплоя",
  "language": "ru",
  "message_length": 42
}
```

Forbidden in payload:

- tokens;
- private keys;
- env secret values;
- raw credentials;
- full personal memory dumps;
- unfiltered attachments;
- unrelated private conversations.

## Tool object

For tool events:

```json
{
  "name": "sg_diagnostics_check",
  "ok": true,
  "error": null
}
```

For non-tool events, `tool` should be `null`.

## Policy object

```json
{
  "sensitivity": "internal",
  "retention": "latest_only",
  "sanitized": true,
  "memory_candidate": false
}
```

Sensitivity:

```text
public      safe to show broadly
internal    safe inside SG/runtime reports
private     sensitive user/project context
secret      forbidden for observation events
```

Retention:

```text
latest_only       keep only latest snapshot
short_term        keep short-term operational history
memory_candidate may be considered for memory after policy approval
do_not_store      do not persist
```

Hard rule:

```text
secret observations are invalid
```

## Links object

```json
{
  "runtime_report_path": "runtime/render/latest/latest-render-logs.json",
  "related_commit_sha": "",
  "related_run_id": ""
}
```

Links point to source-first evidence when available.

## Example: Telegram inbound message

```json
{
  "schema_version": 1,
  "event_id": "",
  "event_type": "transport.message",
  "created_at": "2026-05-09T00:00:00.000Z",
  "source": {
    "system": "sg",
    "transport": "telegram",
    "module": "transport-observer"
  },
  "actor": {
    "role": "monarch",
    "user_ref": "redacted",
    "chat_ref": "redacted"
  },
  "direction": "inbound",
  "summary": "Monarch requested project diagnostics after deploy.",
  "payload": {
    "text_preview": "СГ, проверь состояние проекта после деплоя",
    "language": "ru",
    "message_length": 42
  },
  "tool": null,
  "policy": {
    "sensitivity": "private",
    "retention": "latest_only",
    "sanitized": true,
    "memory_candidate": false
  },
  "links": {
    "runtime_report_path": "",
    "related_commit_sha": "",
    "related_run_id": ""
  }
}
```

## Example: diagnostics tool result

```json
{
  "schema_version": 1,
  "event_type": "diagnostics.result",
  "created_at": "2026-05-09T00:00:00.000Z",
  "source": {
    "system": "sg",
    "transport": "internal",
    "module": "runtime-diagnostics"
  },
  "actor": {
    "role": "system",
    "user_ref": "redacted",
    "chat_ref": "redacted"
  },
  "direction": "internal",
  "summary": "Diagnostics completed: Render logs, env, Actions, registry, commits OK.",
  "payload": {
    "checks_total": 5,
    "checks_ok": 5,
    "checks_failed": 0
  },
  "tool": {
    "name": "sg_diagnostics_check",
    "ok": true,
    "error": null
  },
  "policy": {
    "sensitivity": "internal",
    "retention": "latest_only",
    "sanitized": true,
    "memory_candidate": false
  },
  "links": {
    "runtime_report_path": "runtime/render/latest/latest-render-logs.json",
    "related_commit_sha": "",
    "related_run_id": "349"
  }
}
```

## Validation rules

An event is invalid if:

- schema version is wrong;
- event type is missing;
- created_at is missing;
- source system/module is missing;
- actor role is missing;
- direction is missing;
- sensitivity is `secret`;
- sanitized is not `true`.

## Current status

Status: schema contract only.

No runtime behavior is implemented by this stage.
