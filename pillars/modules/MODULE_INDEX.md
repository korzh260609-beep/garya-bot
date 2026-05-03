# MODULE_INDEX.md — SG 2.0 Module Documentation Index

> AGENT NOTE:
> This file is the entrypoint for SG 2.0 module documentation.
> Read it before creating, moving, renaming, or implementing any module.
> Do not add random module docs, duplicate responsibility, or treat a module as SG itself without explicit Monarch approval.

Статус: ACTIVE SKELETON

---

## Purpose

`pillars/modules/` defines local documentation for SG 2.0 modules.

It exists to reduce guessing before code is written.

---

## Standard module docs

Each mature module may later contain:

```text
README.md
CONTRACTS.md
RISKS.md
CHANGELOG.md
```

Optional later:

```text
DATA_MODEL.md
TESTING.md
DECISIONS.md
```

---

## Initial SG 2.0 modules

1. `core`
2. `config`
3. `permissions`
4. `transport`
5. `memory`
6. `sources`
7. `ai`
8. `tasks`
9. `users`
10. `logging`
11. `delivery`
12. `documents`
13. `repo`
14. `billing`

---

## Maturity labels

- `future` — planned but not implemented.
- `skeleton` — boundaries approved, no full logic yet.
- `partial runtime` — some code exists, still transitional.
- `active` — implemented and operational.

Current SG 2.0 module docs are skeleton-level.

---

## Module entity rule

Modules are components of SG.

A module must never be documented or implemented as a separate SG.

Correct:

```text
SG = global project system
module = bounded responsibility area
```

Incorrect:

```text
module = SG itself
router = SG brain
AI wrapper = SG brain
transport = SG itself
```

---

## Controlled-action rule

Every module must classify actions as:

- read-only;
- analysis-only;
- prepare-only;
- state-changing;
- external-action;
- private-data;
- expensive/costly.

State-changing, private, external or expensive actions need permission/risk/confirmation handling.

---

## Anti-chaos rule

Before adding a new module, decide:

- what responsibility it owns;
- what it must not own;
- what interface it exposes;
- what permissions it needs;
- what risks it creates;
- whether it belongs in existing module instead.

---

## Maintenance rule

Whenever modules are added, removed or re-scoped, update this index in the same work block.
