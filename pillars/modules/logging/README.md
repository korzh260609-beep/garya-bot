# logging — SG 2.0 Logging Module

> AGENT NOTE:
> This file defines the SG 2.0 logging and diagnostics module boundary.
> Read it before adding logs, diagnostics, error tracking, health checks, or audit traces.
> Do not expose private data, secrets, or raw debug internals to users without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`logging` provides observability and diagnostic boundaries.

---

## Owns

- structured logs;
- error boundaries;
- health diagnostics;
- audit traces;
- action logs;
- future runtime monitoring.

---

## Must not own

- business logic;
- transport personality;
- AI reasoning;
- permissions policy ownership;
- secret storage.

---

## Hard rule

Logs help diagnose SG.
Logs must not leak private user data or secrets.
