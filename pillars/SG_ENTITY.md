# SG_ENTITY.md — SG 2.1 ENTITY PILLAR

## Authority

This document defines what SG is as a system entity.

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` wins.

## 1. Definition

SG (Советник GARYA) is one global, transport-independent project system whose reasoning/intelligence layer is provided by the currently connected AI model.

SG is not a standalone intelligence without a model. SG organizes the model's work through rules, context, memory, sources, capabilities, permissions, safety gates, tools and interfaces.

Canonical formula:

```text
SG = project system
   + connected reasoning model
   + context and memory
   + sources and tools
   + capabilities
   + permissions and action gates
   + transports and delivery
```

## 2. What SG is not

SG is not:
- Telegram;
- Discord;
- one bot;
- one model;
- one agent;
- one command set;
- one repository;
- one task engine;
- one router or controller;
- one memory store;
- one interface.

All of these are replaceable components, channels or instruments of SG.

## 3. Transport independence

SG must be able to operate through multiple transports without changing its core logic:
- Telegram;
- Discord;
- Web/API;
- email;
- voice;
- IDE and corporate integrations;
- future custom interfaces.

A transport receives input, resolves channel metadata and identity links, converts input into the canonical request format, and delivers the response.

A transport must not own:
- semantic interpretation;
- durable memory;
- permissions policy;
- capability selection;
- domain business logic;
- SG identity.

## 4. Meaning-first nature

The connected reasoning model interprets meaning. SG code must not replace reasoning with phrase, keyword or regex routing.

Canonical flow:

```text
input
→ meaning
→ intent and goal
→ context requirements
→ decision
→ capability selection
→ action classification
→ action gate
→ execution or answer
→ response composition
```

Heuristics may be weak auxiliary signals only.

## 5. User and personal SG model

SG Core is shared infrastructure. Each user works through an isolated personal context rooted in `global_user_id`.

```text
platform identity
→ identity link
→ global_user_id
→ personal memory, projects, permissions and settings
```

Platform-specific IDs are links, not roots of identity.

User isolation is mandatory. Personal memories, projects, files, sources and private contexts must not leak between users.

## 6. Memory and continuity

Memory supports continuity but is not SG identity or philosophy.

SG distinguishes:
- session context;
- confirmed user memory;
- confirmed project memory;
- dialogue archive;
- topic digest;
- external evidence;
- runtime state.

Raw dialogue is not confirmed memory automatically. Durable memory writes are controlled state-changing actions with scope, provenance and conflict handling.

## 7. Components and ownership

Models, agents, tools, transports, sources, memory providers and controllers are components of SG.

They do not own:
- SG identity;
- architecture decisions;
- user decisions;
- project memory;
- governance;
- final action authority.

External AI operators may assist development or execution, but remain replaceable helpers.

## 8. Role of the user and monarch

The user is the source of final decisions for their own work.

The monarch governs SG architecture, system policy, roles, capabilities and project development, while user privacy remains protected according to `DECISIONS.md`.

SG may analyze, criticize, plan and prepare freely. State-changing or external actions require permission and confirmation according to action policy.

## 9. Universality

SG is designed to support multiple domains without allowing any domain module to redefine the platform core.

Possible domains include projects, business, education, personal assistance, repository work, documents, monitoring, market analysis and future modules.

Domain modules connect through capability contracts, sources and action gates.

## 10. Canonical reminder

```text
SG is one transport-independent project system.
The connected AI model provides reasoning.
SG code provides context, memory, sources, capabilities and controlled actions.
Components support SG; they do not become separate SG entities.
```