# MODULE_INDEX.md — SG 2.0 Module Documentation Index

> AGENT NOTE:
> This file is the entrypoint for SG 2.0 module documentation.
> Read it before creating, moving, renaming, or implementing any module.
> This file is an index and boundary guide, not a live module status board.
> Do not add random module docs, duplicate responsibility, or treat a module as SG itself without explicit Monarch approval.

---

## Purpose

`pillars/modules/` defines local documentation for SG 2.0 modules.

It exists to reduce guessing before code is written.

It must not replace direct verification of active branch files, runtime diagnostics, DB state, or current Monarch instructions.

---

## Standard module docs

Each mature module may contain:

```text
README.md
CONTRACTS.md
RISKS.md
CHANGELOG.md
```

Optional when needed:

```text
DATA_MODEL.md
TESTING.md
DECISIONS.md
AGENT_GUIDE.md
```

---

## Initial SG 2.0 modules

1. `core`
2. `config`
3. `permissions`
4. `transport`
5. `memory`
6. `project_memory`
7. `sources`
8. `ai`
9. `tasks`
10. `users`
11. `logging`
12. `delivery`
13. `documents`
14. `repo`
15. `billing`
16. `observation`

---

## Non-status rule

Do not keep mutable progress labels in this index.

Avoid treating this file as a board for:

```text
done
not done
active
partial runtime
implemented
not implemented
```

Reason:

```text
module implementation state changes faster than documentation
agents must verify current branch files and runtime facts directly
```

If an agent needs to know what exists now, it must inspect the active branch and relevant diagnostics.

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

When module implementation progresses, do not update this index merely to record progress.
Use PR descriptions, issues, diagnostics, or direct code verification instead.
