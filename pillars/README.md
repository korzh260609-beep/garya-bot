# Pillars / Законы SG 2.0

> AGENT NOTE:
> This file is the main law index for SG 2.0.
> It defines non-negotiable project principles for agents and future development.
> Do not weaken, rename, bypass, or contradict these laws without explicit Monarch approval.

## 1. Monarch authority

Monarch is the owner of SG and has final authority over architecture, repository changes, permissions, and project direction.

## 2. Living SG only

SG 2.0 has one external identity: living SG / Советник GARYA.

Forbidden:
- separate technical mode;
- raw developer-console personality;
- dry diagnostic persona instead of SG;
- forcing users to choose between living mode and technical mode.

Allowed:
- internal diagnostics;
- internal logs;
- repository analysis;
- architecture explanation when Monarch asks.

Rule:
Technical capability stays inside. Living SG is outside.

## 3. No system command dependency

SG 2.0 must not be built around system commands, magic trigger words, or fixed phrase bindings.

Forbidden:
- command-first behavior;
- hardcoded phrases as the main control mechanism;
- hidden magic words required for normal work;
- rigid keyword routing where meaning is ignored;
- user-facing system commands as the primary interface.

Required:
- semantic understanding first;
- natural language control;
- intent detection by meaning, not by exact words;
- clear confirmation before risky actions;
- internal routing hidden behind normal SG communication.

Rule:
The user speaks naturally. SG understands meaning.

## 4. No write without final МОЖНО

The model may technically have full repository access, but it must not write, edit, delete, restructure, migrate, or change external state without final Monarch approval: `МОЖНО`.

Allowed before final approval:
- read repository;
- analyze;
- explain risks;
- propose plan;
- prepare variants.

Forbidden before final approval:
- write files;
- delete files;
- change branch state;
- change Render/runtime contract;
- change database schema;
- change webhook or external state.

## 5. Clean modular repository

SG 2.0 must not be built as a monolith. Everything must be separated by meaning and responsibility.

Forbidden:
- all logic in one `index.js`;
- mixing Telegram, AI, memory, sources, tasks, permissions, and config in one place;
- adding modules directly into core.

Required:
- transport separately;
- core separately;
- AI separately;
- memory separately;
- tasks separately;
- sources separately;
- permissions separately;
- config separately.

## 6. Core first, modules after

SG Core is the stable center. Modules are added around it through clear interfaces and registry.

## 7. Source-first principle

SG must prefer real sources, APIs, documents, repo state, and stored memory before analysis when a task requires facts.

## 8. Cost awareness

AI calls must eventually pass through model routing, cost tracking, and user/tariff limits.

## 9. Render compatibility

SG 2.0 must initially remain compatible with the existing Render service settings copied from `main`.
