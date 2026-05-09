# Observation IO Boundary V1

## Purpose

This document defines the first writer/reader boundary for SG Observation reports.

This stage does not connect Telegram, tools, diagnostics, memory, or any autonomous behavior.

It only creates a narrow place where future observer agents can write and read sanitized reports.

## Runtime path

Observation reports may only use paths under:

```text
runtime/observation/
```

V1 latest reports use:

```text
runtime/observation/latest/{name}.json
```

Future archive reports may use:

```text
runtime/observation/archive/YYYY-MM-DD/{name}.jsonl
```

## Writer boundary

The writer builds an `observation_report` object:

```json
{
  "ok": true,
  "type": "observation_report",
  "generated_at": "2026-05-09T00:00:00.000Z",
  "name": "telegram-latest",
  "summary": "short summary",
  "events_count": 1,
  "invalid_events_count": 0,
  "invalid_events": [],
  "events": [],
  "policy": {
    "sanitized": true,
    "runtime_path_only": true,
    "no_memory_write": true
  }
}
```

Before writing, all events must pass `validateObservationEvent`.

Invalid events are rejected and not written.

## Reader boundary

The reader reads only latest JSON reports from:

```text
runtime/observation/latest/{name}.json
```

It parses JSON and returns a structured read result.

## Hard boundaries

The IO boundary must not:

- connect to Telegram;
- call AI;
- call diagnostics;
- write memory;
- approve GitHub writes;
- change Render state;
- change GitHub settings;
- read or write outside `runtime/observation/`.

## Relationship to WorkspaceChannel

Observation IO uses the existing `WorkspaceChannel` for GitHub-backed runtime files.

The Observation layer owns only the observation-specific path rules and report format.

## Current status

Status: IO boundary skeleton only.

No runtime producer is connected yet.
