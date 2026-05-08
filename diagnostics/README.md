# SG 2.0 Diagnostics Workspace

> AGENT NOTE:
> This folder is the canonical workspace for SG diagnostics, test notes, investigation reports, and diagnostic plans.
> Keep diagnostics separate from runtime code, agents, transport, memory, and Render bridge implementation.
> Do not store secrets, raw env values, private tokens, or unmasked credentials here.

Status: ACTIVE_WORKSPACE

---

## Purpose

`diagnostics/` stores human-readable diagnostic materials for SG 2.0.

This folder exists so debugging and tests do not get scattered across chat, runtime files, agents, or core code.

---

## What belongs here

- diagnostic reports;
- test plans;
- investigation notes;
- failure analyses;
- reproduction steps;
- checklists;
- post-fix verification notes;
- safe summaries of runtime/tool errors.

---

## What does not belong here

- source code for runtime features;
- Telegram transport logic;
- Render bridge implementation;
- AI tool implementation;
- DB schema changes;
- secrets or raw env values;
- unmasked tokens;
- generated noisy logs without filtering.

---

## Subfolders

```text
diagnostics/
  README.md
  tests/
    README.md
  reports/
    README.md
```

---

## Rule

Diagnostics may explain problems and planned tests.

Diagnostics must not silently change system behavior.

Any runtime fix still requires a normal feature/fix branch, PR, checks, and Monarch approval before merge.
