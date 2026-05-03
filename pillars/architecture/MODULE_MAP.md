# MODULE_MAP.md — SG 2.0 Logical Modules

> AGENT NOTE:
> This file defines the logical module map for SG 2.0.
> Read it before creating new folders, modules, services, handlers, or registries.
> Do not merge unrelated responsibilities into one module or hide modules inside each other without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Core modules

Initial logical modules:

1. `core` — orchestrator and request flow coordination.
2. `config` — centralized settings and feature flags.
3. `permissions` — roles, capabilities, confirmations, gates.
4. `transport` — Telegram/web/API adapters.
5. `memory` — memory interface and memory services.
6. `sources` — RSS/API/web/docs/repo providers.
7. `ai` — AI wrapper/router and model config.
8. `tasks` — scheduled and one-time tasks.
9. `users` — identity, profiles, plans, access status.
10. `logging` — logs, diagnostics, errors.
11. `delivery` — formatting and sending results.
12. `documents` — future file intake and document parsing.
13. `repo` — repo reading, repo facts, repo audit helpers.
14. `billing` — future AI credits and usage accounting.

---

## Rule

Each module owns one responsibility.

If a file grows to mix responsibilities, split it before it becomes a monolith.

---

## Forbidden

- Telegram handler owning AI logic.
- Memory logic inside transport.
- Source parsing inside prompt builder.
- Permissions scattered across files.
- Feature logic inside core.
- All logic inside `index.js`.

---

## Current SG 2.0 status

This is a skeleton map.
Actual code modules must be added step by step after approval.
