# DATA_FLOW.md — SG 2.0 Data Flow

> AGENT NOTE:
> This file defines the high-level data flow for SG 2.0.
> Read it before changing request handling, source access, memory access, AI calls, delivery, or actions.
> Do not add shortcuts that bypass permissions, sources, or confirmations without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Main flow

```text
User message
-> Transport Adapter
-> Core Orchestrator
-> Identity / User Scope
-> Capability / Permission Check
-> Memory Context
-> Sources if facts are needed
-> AI Layer if reasoning is needed
-> Risk / Confirmation Check
-> Result / Action
-> Delivery
```

---

## Read-only flow

```text
request
-> understand meaning
-> gather context/source facts
-> analyze
-> answer
```

No state change allowed.

---

## State-changing flow

```text
request
-> understand meaning
-> detect state-changing action
-> check permission
-> explain risk
-> request confirmation
-> execute only after approval
-> log result
```

---

## Source-first flow

```text
fact request
-> choose source
-> retrieve real data
-> normalize result
-> pass facts to AI layer
-> answer with uncertainty if needed
```

---

## Forbidden bypasses

- user -> AI -> action without permission;
- transport -> AI without core;
- AI -> repo write without confirmation;
- memory -> answer as factual truth without source check when current facts are needed;
- source failure -> confident invented answer;
- handler -> database mutation without policy/gate.
