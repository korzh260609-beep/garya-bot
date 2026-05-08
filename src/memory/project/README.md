# SG 2.0 Project Memory

> AGENT NOTE:
> This folder owns the skeleton for SG project memory.
> Do not use this folder as a replacement for pillars, repository facts, workflow files, runtime reports, commits, PRs, Actions, or Render facts.
> Do not use this folder for user-owned project memory.
> Do not add DB writes, source fetching, AI calls, Telegram logic, or repo write actions here without explicit Monarch approval.

Status: SKELETON

---

## Purpose

`src/memory/project/` defines how SG will handle confirmed project memory for the SG project itself.

Project memory helps SG remember stable SG project facts, decisions, boundaries, risks, terminology, and implementation notes.

Project memory supports the Living SG identity and SG project reasoning.

It must not become a command router, technical mode, or fake source of truth.

---

## Project memory boundary

There are two different project-memory categories in SG architecture.

```text
1. SG Project Memory
Memory of the SG project itself:
architecture, rules, PRs, rollback points, workflow, Monarch decisions.

2. User Project Memory
Memory of concrete user projects:
user businesses, development work, documents, tasks, ideas, and work history.
```

This folder owns only:

```text
SG Project Memory
```

This folder does not own:

```text
User Project Memory
```

User Project Memory must be implemented later as a separate bounded module, for example:

```text
src/memory/user-projects/
```

or another Monarch-approved boundary.

Required future rule:

```text
global_user_id
  -> user_project_id
    -> user project memory
    -> project files/facts
    -> tasks
    -> decisions
    -> summaries
```

A single user may have many projects. Each user project must have isolated memory and must not mix with SG Project Memory or with another user's project memory.

---

## Source priority

For SG project work, project memory is below verified project sources.

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

## What SG project memory may store

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

## What SG project memory must not store

- secrets;
- raw env values;
- unverified guesses;
- raw chat as confirmed fact;
- personal user memories;
- group memories;
- user-owned project memories;
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
- runtime connection to Core Orchestrator;
- user project memory runtime logic.

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

SG project memory may later feed the AI Context Pack as `PROJECT_MEMORY` items.

It must be marked as confirmed memory and lower priority than pillars/repo/runtime facts.

User Project Memory must use a separate future context item type or an explicit metadata boundary so it cannot be confused with SG Project Memory.

---

## Hard rules

```text
SG project memory != pillars replacement
SG project memory != repo source
SG project memory != raw chat archive
SG project memory != user memory
SG project memory != user project memory
SG project memory != technical mode
SG project memory != command router
```
