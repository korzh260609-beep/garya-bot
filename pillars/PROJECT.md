# PROJECT.md — SG 2.1 PROJECT PILLAR

## 1. Purpose

SG (Советник GARYA) is a transport-independent project system for reasoning support, memory, project continuity, source-backed analysis and controlled execution.

The connected AI model provides reasoning and language intelligence. SG code organizes context, memory, sources, tools, capabilities, permissions, confirmations and delivery.

SG is not a chatbot product tied to one platform. Telegram is one access channel among many.

## 2. Canonical hierarchy

```text
DECISIONS
→ ARCHITECTURE
→ ROADMAP
→ WORKFLOW
→ CODE
→ TEST / RUNTIME EVIDENCE
```

- `DECISIONS.md` defines accepted global decisions.
- `architecture/` defines system contracts and boundaries.
- `roadmap/` defines dependency order.
- `workflow/` defines implementation procedure.

## 3. Canonical system flow

```text
Transport Input
→ Canonical Request
→ Semantic Kernel
→ Context Resolution
→ Decision Envelope
→ Capability Selection
→ Action Classification
→ Action Gate
→ Execution or Answer
→ Response Composition
→ Transport Delivery
→ Observability
```

This flow is platform-independent.

## 4. Core layers

### 4.1 Semantic Kernel
Interprets meaning, goal, intent, uncertainty, context needs, evidence needs and candidate actions.

It must not depend on Telegram commands, database tables or keyword routing.

### 4.2 Context and Memory
Provides bounded session, user, project, archive, digest, evidence and runtime context.

Memory supports continuity but does not replace reasoning or become an automatic source of truth.

### 4.3 Decision and Safety
Transforms semantic understanding into a proposed next step and classifies the action.

Protected actions pass identity, permission, scope, source, risk, cost, confirmation and idempotency checks.

### 4.4 Capability System
Capabilities are replaceable abilities with explicit input/output contracts, action class, permissions, source/tool requirements, risk, cost and fallback policy.

### 4.5 AI Routing
AI Router selects models and modalities, applies specialized-first and fallback policy, records cost and reason, and remains a control wrapper rather than SG brain.

### 4.6 Transports
Telegram, Discord, Web/API, email, voice, IDE and future interfaces are thin adapters.

They must not own semantic logic, durable memory, permissions policy, capability selection or domain business logic.

### 4.7 Observability
Every important decision, source call, model call and protected action must be traceable without exposing private content unnecessarily.

## 5. Transport independence

All channels connect to the same SG core.

```text
Telegram ─┐
Discord ──┤
Web/API ──┤
Email ────┤→ Canonical Request → Shared SG Core
Voice ────┤
Future ───┘
```

The same person is resolved through `global_user_id`. Channel switching must not create a new identity, separate memory or separate SG logic.

## 6. Multi-user model

SG Core is shared infrastructure. Each user receives isolated personal context:

```text
User
→ global_user_id
→ personal memory
→ projects
→ sources
→ permissions
→ settings
```

Private contexts must not mix. Monarch governance over system architecture does not imply unrestricted access to private user memory.

## 7. Source-first correctness

The AI model is not a factual source by default.

When facts matter, SG uses verified sources, documents, APIs, files, repositories or runtime evidence and preserves source metadata, freshness, uncertainty and failure state.

## 8. Controlled execution

SG distinguishes:
- read-only;
- analysis-only;
- prepare-only;
- state-changing;
- external-action;
- private-data;
- expensive-costly actions.

Analysis and preparation may continue when execution is blocked. State-changing or external actions require permission and confirmation where applicable.

## 9. Development order

SG 2.1 is built in this dependency order:

```text
Constitution
→ Semantic Kernel
→ Context and Memory
→ Decision and Safety
→ Capability System
→ Interfaces
→ Automation and Agents
→ Domain Modules
```

Telegram, Discord, databases, schedulers and domain modules must not define the early core architecture.

## 10. Domain modules

Crypto, psychology support, documents, repository analysis, business automation, billing and future modules are consumers of the platform core.

They connect through capability contracts, sources and action gates and must not redefine SG identity, memory model or semantic kernel.

## 11. Development discipline

Every new capability follows:

```text
skeleton
→ config
→ minimal logic
→ tests
→ observability
→ safety
→ evidence
```

Architecture changes require an accepted decision. One change block should remain coherent, reversible and testable.

## 12. GARYA relationship

The Kingdom of GARYA provides the governance, ownership and long-term purpose of the project.

SG is its central digital system, but not an autonomous sovereign decision-maker. The monarch defines system-level direction; users retain final authority over their own work and protected data.

## 13. Definition of success

SG 2.1 is correctly built when:
- meaning is interpreted independently of exact phrasing;
- the core works without a mandatory Telegram dependency;
- transports are replaceable;
- models are replaceable;
- memory is bounded, typed and attributable;
- capabilities are contract-driven;
- protected actions cannot bypass the gate;
- user contexts remain isolated;
- facts are source-backed;
- domain modules can be added without rewriting the core.

## 14. Canonical formula

```text
SG 2.1
= transport-independent project system
+ connected reasoning model
+ semantic kernel
+ context and memory
+ source-backed capabilities
+ controlled actions
+ replaceable interfaces
```