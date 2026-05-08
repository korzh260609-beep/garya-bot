# SG 2.0 Project Memory

> AGENT NOTE:
> This folder owns the skeleton for SG project memory.
> Do not use this folder as a replacement for pillars, repository facts, workflow files, runtime reports, commits, PRs, Actions, or Render facts.
> Do not add DB writes, source fetching, AI calls, Telegram logic, or repo write actions here without explicit Monarch approval.

Status: SKELETON

---

## Purpose

`src/memory/project/` defines how SG will handle confirmed project memory.

Project memory helps SG remember stable project facts, decisions, boundaries, risks, terminology, and implementation notes.

Project memory supports the Living SG identity and project reasoning.

It must not become a command router, technical mode, or fake source of truth.

---

## Source priority

For project work, project memory is below verified project sources.

Priority order:

```text
1. pillars / laws
2. repository files from the current branch
3. runtime reports
4. commits / PRs / GitHub Actions / Render facts
5. confirmed project memory
6. session context
7. bounded raw restore only when explicitly allowed
```

Rule:

```text
Project memory helps recall.
Project memory does not override source-first facts.
```

---

## What project memory may store

- approved architecture decisions;
- workflow rules;
- module boundaries;
- active branch and repo workflow rules;
- project terminology;
- implementation status summaries;
- rollback points;
- known risks;
- decisions imported from old `main` after review;
- Monarch-approved project principles.

---

## What project memory must not store

- secrets;
- raw env values;
- unverified guesses;
- raw chat as confirmed fact;
- personal user memories;
- group memories;
- temporary debugging noise;
- facts that should stay only in repository files;
- generated answers pretending to be source truth.

---

## Initial mode

Project memory starts as:

```text
read-only / prepare-only skeleton
```

Allowed now:

- define types;
- normalize provided project memory items;
- build a candidate project memory item;
- return warnings;
- prepare future contracts.

Forbidden now:

- DB writes;
- DB reads;
- automatic extraction from chat;
- automatic promotion to confirmed memory;
- source fetching;
- AI calls;
- repo writes;
- runtime connection to Core Orchestrator.

---

## Future flow

Expected future flow:

```text
verified source facts
-> project memory candidate
-> policy check
-> Monarch approval or approved automation rule
-> confirmed project memory storage
-> bounded selection into AI context pack
```

---

## Relationship to AI Context Pack

Project memory may later feed the AI Context Pack as `PROJECT_MEMORY` items.

It must be marked as confirmed memory and lower priority than pillars/repo/runtime facts.

---

## Hard rules

```text
project memory != pillars replacement
project memory != repo source
project memory != raw chat archive
project memory != user memory
project memory != technical mode
project memory != command router
```
