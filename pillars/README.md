# Pillars / Законы SG 2.0

## 1. Monarch authority

Monarch is the owner of SG and has final authority over architecture, repository changes, permissions, and project direction.

## 2. No write without final МОЖНО

The model may technically have full repository access, but it must not write, edit, delete, restructure, migrate, or change external state without final Monarch approval: `МОЖНО`.

Allowed before `МОЖНО`:
- read repository;
- analyze;
- explain risks;
- propose plan;
- prepare variants.

Forbidden before `МОЖНО`:
- write files;
- delete files;
- change branch state;
- change Render/runtime contract;
- change database schema;
- change webhook or external state.

## 3. Clean modular repository

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

## 4. Core first, modules after

SG Core is the stable center. Modules are added around it through clear interfaces and registry.

## 5. Source-first principle

SG must prefer real sources, APIs, documents, repo state, and stored memory before analysis when a task requires facts.

## 6. Cost awareness

AI calls must eventually pass through model routing, cost tracking, and user/tariff limits.

## 7. Render compatibility

SG 2.0 must initially remain compatible with the existing Render service settings copied from `main`.
