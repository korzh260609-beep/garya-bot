# DECISIONS.md — SG 2.1 CANONICAL DECISIONS

Status: CANONICAL
Owner: Monarch Gary

This file contains only accepted global decisions for SG 2.1.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## D-001 — SG is one transport-independent project system
SG is not Telegram, Discord, one bot, one model, one agent, one router, one repository or one interface. These are replaceable components, channels or tools.

## D-002 — The connected AI model provides reasoning
The selected reasoning model interprets meaning, analyzes and plans. SG code must not attempt to replace trained reasoning with keyword, phrase, regex or template logic.

## D-003 — SG code organizes controlled work
SG code owns context access, memory boundaries, source/tool access, capability contracts, permissions, risk, cost, confirmation, idempotency, audit and execution control.

## D-004 — Natural language is the primary interface
Commands are diagnostic or administrative shortcuts. A capability must exist independently from any command that invokes it.

## D-005 — Semantic Kernel precedes transports and storage
The first core is platform-independent. Telegram, Discord, Web/API, email and voice are added later as thin adapters.

## D-006 — Controllers protect actions; they do not become SG brain
The reasoning layer understands meaning. Action Gate validates identity, permission, scope, source/tool availability, risk, cost, confirmation, idempotency and audit requirements.

## D-007 — SG is free in analysis and controlled in actions
Analysis, explanation, criticism, planning, simulation and prepare-only output are allowed within policy. State-changing, external, private-data and expensive actions require the applicable gates and confirmation.

## D-008 — global_user_id is the root of personal identity
Platform IDs are links only. Personal memory, projects, settings, permissions and sources are isolated by global identity and scope.

## D-009 — Memory layers are distinct
Session context, confirmed user memory, confirmed project memory, dialogue archive, topic digest, external evidence and runtime state must not be mixed. Raw dialogue never becomes confirmed memory automatically.

## D-010 — Sources and AI are not automatically truth
Factual claims requiring verification must use available sources or clearly disclose uncertainty. AI output, chat history and summaries are not verified evidence by themselves.

## D-011 — Capabilities are contract-driven and replaceable
Every capability declares input, output, action class, permissions, source/tool needs, risk, cost, confirmation, timeout, retry, observability and fallback behavior.

## D-012 — Transports are thin adapters
Transports receive input, resolve channel metadata and identity links, create CanonicalRequest and deliver responses. They do not own semantics, durable memory, permissions, capability selection or domain logic.

## D-013 — Domain modules cannot redefine the core
Crypto, psychology support, repository analysis, documents, billing and other domains consume platform contracts. They cannot change SG identity or core execution flow.

## D-014 — Architecture changes require explicit monarch approval
Global architecture changes must be accepted here before implementation. Implementation convenience cannot silently change SG principles.

## D-015 — Completion comes from evidence
Pillars contain no manual done/status markers. Completion is derived from code, tests and verified runtime evidence.

## D-016 — Development order is fixed by the active roadmap
The canonical order is:

```text
Constitution
→ Semantic Kernel
→ Context and Memory
→ AI Routing Foundation
→ Decision Engine
→ Action Gate
→ Capability System
→ Identity and Scope
→ Observability
→ Interfaces
→ Automation and Agents
→ Domain Modules
→ Runtime Composition
→ PostgreSQL Persistence
→ Durable Automation and Workers
→ Telegram Production Integration
→ Production AI Integration
→ Production Capabilities
→ Render Deployment
→ End-to-End Verification
→ Security and Operations
→ Pilot Launch
```

Blocks 0–10 form the platform-core program. Blocks 11–19 and Pilot Launch form the production continuation defined by `pillars/roadmap/PRODUCTION_ROADMAP.md`.

## D-017 — Development procedure is fixed by workflow
Every implementation block follows: scope → contracts → skeleton → config → minimal logic → tests → observability → safety → architecture verification → reversible commit → evidence.

## D-018 — Historical SG 2.0 documentation is not active truth
Old runtime notes, command architecture, Human/Technical Mode documents, RepoStateAgent-specific architecture, old module contracts and old stage numbering must not be restored into active pillars.

## D-019 — Identity resolution is centralized and scoped
Identity links, actor resolution and scope construction belong to the Identity layer. Transports provide platform facts but cannot grant roles, merge identities or broaden scope.

## D-020 — Observability is mandatory and privacy-bounded
Every important request, model call, capability execution, gate decision and failure carries trace context. Audit, telemetry and debug data are separated, secrets are redacted, and private content is minimized.

## D-021 — Production AI access is introduced through Block 2.5
After Semantic Kernel and Context and Memory are stable, the first production reasoning provider is connected only through AI Router. Direct provider calls from SG modules are forbidden. Decision Engine development begins only after the routed reasoning path is validated by tests and CI evidence.

## D-022 — Productionization preserves the approved core architecture
The production continuation may compose modules, replace reference providers with durable implementations, connect real transports and AI providers, deploy services and add operational controls. It must not bypass or relocate Semantic Kernel, Identity and Scope, Decision Engine, Action Gate, Capability contracts, AI Router, memory boundaries, trust order or observability responsibilities.

Production readiness requires real runtime evidence. Unit tests or a successful process start alone cannot prove Telegram delivery, persistence, worker recovery, deployment safety or pilot readiness.
