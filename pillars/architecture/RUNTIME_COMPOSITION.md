# SG 2.1 — Runtime Composition

## Authority

This document is subordinate to `pillars/DECISIONS.md` and the existing architecture contracts. It defines composition only; it does not relocate responsibilities from Semantic Kernel, Identity and Scope, Decision Engine, Action Gate, Capability System, AI Router, Memory, Observability, Interfaces, Automation or Domain Modules.

## Production runtime path

```text
Transport Input
→ Transport Adapter
→ Identity and Scope
→ CanonicalInput
→ Context and Memory
→ Meaning Interpretation
→ Decision Engine
→ Action Gate
→ Capability or Domain Runtime
→ Response Plan
→ Transport Delivery
```

## Composition root

`src/runtime/createProductionRuntime.js` is the production composition boundary. Dependencies are passed explicitly. Hidden global service construction is forbidden.

Mandatory dependencies:

- validated runtime configuration;
- context-aware semantic pipeline;
- Action Gate;
- Capability Executor;
- Observability Service.

Optional explicit dependencies:

- Domain Runtime, required when a selected action declares `domainId`;
- closeable resources, closed in reverse registration order.

## Lifecycle

Runtime phases are `created`, `starting`, `ready`, `stopping`, `stopped` and `failed`.

- Requests are accepted only in `ready` phase.
- Shutdown first stops acceptance of new work.
- Existing requests receive a bounded drain window.
- Resources close only after in-flight work reaches zero.
- Invalid configuration and missing mandatory dependencies fail before readiness.

## Health and readiness

Health reports process/runtime failure state. Readiness reports whether the runtime currently accepts requests. A healthy process may be not-ready during startup or shutdown.

## Safety boundaries

- Transport adapters cannot assign final roles or grants.
- Every request receives canonical identity, scope and trace contexts before semantic processing.
- Protected and executable intent is evaluated by Action Gate before execution.
- Capability execution requires the exact allowed `GateDecision` for the exact `ActionRequest`.
- Domain execution remains inside Domain Runtime and cannot redefine core contracts.
- Runtime events use the existing observability contracts and redaction boundary.
