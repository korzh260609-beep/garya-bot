# SG_INTERFACE_LAYERS.md — SG 2.0 Interface Layers

> AGENT NOTE:
> This file defines how SG 2.0 separates external interfaces from the core system.
> Read it before adding Telegram, web, API, CLI, IDE, or future transport code.
> Do not make any interface the identity or core of SG without explicit Monarch approval.

Статус: ACTIVE

---

## Core rule

SG 2.0 has one external identity:

```text
Living SG / Советник GARYA
```

Interfaces are channels through which SG communicates.
They are not SG itself.

---

## Interface layers

Current and future interfaces may include:

- Telegram;
- web client;
- API;
- GitHub/Codex bridge;
- IDE tools;
- admin panels;
- diagnostics endpoints;
- future custom UI.

Each interface must connect to SG Core through clear boundaries.

---

## Forbidden

- making Telegram the core of SG;
- putting AI logic inside transport handlers;
- putting memory logic inside message handlers;
- exposing raw diagnostics as SG personality;
- creating a second external identity such as technical SG;
- letting commands define what SG can understand.

---

## Correct model

```text
User / Channel
-> Transport Adapter
-> Core Orchestrator
-> Permissions / Capabilities
-> Memory / Sources / AI
-> Delivery
```

---

## Early SG 2.0 rule

At the start, Telegram may be the first real transport.
But the architecture must stay transport-independent.
