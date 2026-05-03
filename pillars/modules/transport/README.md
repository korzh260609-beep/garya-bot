# transport — SG 2.0 Transport Module

> AGENT NOTE:
> This file defines the SG 2.0 transport module boundary.
> Read it before adding Telegram, web, API, webhook, polling, or message adapter code.
> Do not put AI, memory, permissions, source parsing, or task logic directly into transport without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`transport` connects external channels to SG Core.

Transport receives messages and delivers responses.
It must not become SG itself.

---

## Owns

- Telegram adapter;
- future web/API adapters;
- webhook route boundary;
- message normalization;
- delivery handoff;
- channel-specific metadata.

---

## Must not own

- AI reasoning;
- memory decisions;
- permission logic;
- source fetching;
- task execution;
- business rules.

---

## Hard rule

```text
transport -> core -> modules
```

Not:

```text
transport -> everything
```
