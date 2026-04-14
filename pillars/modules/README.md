# modules/README.md — Module Documentation System

Purpose:
- Explain how `pillars/modules/` is organized.
- Standardize per-module documentation.
- Prevent random formats and mixed-purpose files.

Status: CANONICAL
Scope: all module folders under `pillars/modules/`

---

## 0) Why this folder exists

Root `pillars/` files describe SG at the global level.

`pillars/modules/` exists for local module-level documentation:

- boundaries
- contracts
- risks
- evolution
- local accepted decisions

This folder must reduce guessing during code work.

---

## 1) One folder = one stable module

Use one folder per stable responsibility domain.

Examples:
- `memory`
- `transport`
- `users`
- `repo`
- `sources`
- `tasks`
- `bot`

Do NOT create folders for:
- random ideas
- one temporary bug
- each workflow micro-step
- each command unless it is its own module

---

## 2) Recommended module file set

Each module folder should aim to contain:

- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`

Optional:
- `DECISIONS.md`
- `TESTING.md`
- `DATA_MODEL.md`

---

## 3) What each file means

### `README.md`
Use for:
- purpose
- boundaries
- in-scope / out-of-scope
- dependencies
- invariants
- ownership

### `CONTRACTS.md`
Use for:
- public interfaces
- input/output definitions
- preconditions
- postconditions
- side effects
- error behavior

### `RISKS.md`
Use for:
- failure modes
- dangerous assumptions
- likely regressions
- what to verify after changes

### `CHANGELOG.md`
Use for:
- meaningful local evolution
- behavior changes
- structural changes that matter later

### local `DECISIONS.md`
Use only when:
- a module has multiple accepted local decisions
- these decisions are too detailed for root `pillars/DECISIONS.md`

---

## 4) File writing style

Module docs should prefer:

- short sections
- explicit boundaries
- non-ambiguous wording
- clear “must / must not”
- practical future-useful context

Avoid:
- essays
- motivational text
- duplicated content from root pillars
- speculative drafts in canonical files

---

## 5) Update rule

When a module evolves, its local docs must evolve too.

At minimum update:
- `README.md` if boundaries/responsibilities changed
- `CONTRACTS.md` if interface behavior changed
- `RISKS.md` if new risks appeared or risk model changed
- `CHANGELOG.md` for meaningful local changes

---

## 6) First reference module

The first reference implementation for this system is:

`pillars/modules/memory/`

Future module docs should follow the same pattern unless a strong reason exists to diverge.

---

## 7) Final rule

This folder exists to make future work cheaper, safer, and less dependent on memory or chat context.

If module docs stop matching the real module,
they stop helping and start harming.