# project_memory — SG 2.0 Project Memory Module

> AGENT NOTE:
> This file defines the SG 2.0 Project Memory module boundary.
> Read it before adding project memory reads, writes, confirmations, sync, context building, restore logic, or project experience storage.
> Do not add Telegram integration, AI calls, automatic memory writes, raw logs, raw provider IDs, timers, cron, autonomous actions, or secret exposure here without explicit Monarch approval.

Статус: SKELETON / DOCS-ONLY

---

## 1. Purpose

Project Memory is SG 2.0's controlled project-continuity layer.

Its purpose is to help SG restore confirmed project context, active constraints, decisions, risks, and next safe steps across work sessions.

In simple terms:

```text
confirmed project fact → controlled memory entry → bounded project context → safer next action
```

Project Memory supports continuity.

It does not replace source-of-truth documents, repository facts, runtime facts, or Monarch decisions.

---

## 2. Why this module exists

Without Project Memory, project work depends too much on the current chat window, temporary notes, or manual context restore blocks.

With Project Memory, SG should be able to:

- remember confirmed project decisions;
- restore active constraints before project work;
- distinguish confirmed facts from raw chat context;
- keep next steps visible;
- avoid repeating already-settled architecture decisions;
- warn when a requested action conflicts with known constraints;
- support long-running development without turning memory into uncontrolled prompt noise.

---

## 3. What Project Memory stores

Project Memory may store only bounded, confirmed, project-level entries.

Allowed memory classes:

- confirmed project decisions;
- confirmed architecture constraints;
- confirmed workflow rules;
- confirmed module boundaries;
- confirmed next steps;
- confirmed risks and open questions;
- session summaries approved or created through a trusted path;
- project capability/status snapshots when explicitly generated from verified evidence;
- project experience lessons after review.

Every durable entry should include enough metadata to make it traceable:

```text
source_type
source_ref
module_key
stage_key
confidence
created_by
created_at
status
```

---

## 4. What Project Memory must not store

Project Memory must not store:

- secrets;
- raw logs;
- raw provider IDs;
- private transport identifiers;
- unverified chat claims as facts;
- raw user dialogue dumps;
- personal user memory unrelated to project continuity;
- temporary hallucinated summaries;
- AI guesses without evidence;
- repo/runtime facts that must be re-read from source;
- decisions that contradict `pillars/DECISIONS.md` without explicit Monarch update.

Hard rule:

```text
Raw chat is source material only.
Raw chat is not confirmed Project Memory.
```

---

## 5. Source-of-truth hierarchy

Project Memory is not the highest authority.

Authority order:

1. Explicit Monarch instruction in the current task.
2. `pillars/DECISIONS.md` and other approved pillars.
3. Verified repository files at the active branch/ref.
4. Verified runtime/diagnostics/observation facts.
5. Confirmed Project Memory entries.
6. Current chat context.
7. AI inference.

If Project Memory conflicts with a higher source, SG must warn and prefer the higher source.

---

## 6. Module boundary

Project Memory owns:

- project memory entry categories;
- read contracts;
- controlled write contracts;
- confirmation contracts;
- sync contracts;
- bounded context building;
- stale/conflict detection rules;
- memory metadata requirements;
- project restore support context.

Project Memory must not own:

- Telegram handlers;
- AI model calls;
- Core orchestration;
- repository fetching;
- Render fetching;
- observation event production;
- permission policy ownership;
- deployment control;
- autonomous task scheduling;
- raw long-term chat archive.

---

## 7. Relationship to other modules

### 7.1 Pillars

Pillars are higher authority than Project Memory.

Project Memory may summarize or point to pillars, but it must not redefine them.

### 7.2 Repo module

Repo facts must be verified from repository sources.

Project Memory may store a snapshot or lesson, but it must not pretend to be the live repository.

### 7.3 Observation module

Observation reports are runtime telemetry.

Project Memory may consume sanitized observation summaries later, but observation must not write Project Memory by itself.

### 7.4 Memory module

General memory handles broader memory mechanics.

Project Memory is the project-specific continuity layer and must still use approved memory interfaces.

### 7.5 Transport modules

Transport delivers messages.

Transport must not decide what becomes durable Project Memory.

---

## 8. Current skeleton scope

This docs-only skeleton defines:

- purpose;
- boundary;
- allowed content;
- forbidden content;
- source-of-truth hierarchy;
- interface families;
- risks;
- future runtime gates.

It does not implement:

- database tables;
- runtime code;
- AI calls;
- Telegram commands;
- sync jobs;
- cron/timers;
- automatic memory writes;
- migrations;
- observation consumers.

---

## 9. Safe action classes

Read-only:

- read confirmed project memory;
- read memory diagnostics;
- read bounded project context;
- inspect stale/conflict status.

Prepare-only:

- prepare documentation;
- prepare contracts;
- prepare PR plans;
- prepare migration plans;
- prepare test plans.

State-changing:

- write durable project memory;
- update existing project memory;
- confirm a pending memory candidate;
- sync memory from trusted sources;
- create branches/PRs.

Forbidden without explicit approval:

- automatic memory writes from raw chat;
- production code mutation;
- secrets handling;
- raw logs storage;
- raw provider ID storage;
- uncontrolled context injection;
- autonomous background sync;
- Telegram-coupled memory logic;
- AI-generated facts written without confirmation.

---

## 10. Final target system

The final Project Memory module should become SG's safe project-continuity layer.

Final target:

```text
SG restores the right project context before project work, uses confirmed memory only as bounded support context, detects conflicts/staleness, and never treats memory as stronger than pillars, repo evidence, runtime evidence, or Monarch decisions.
```

Final system should include:

1. Controlled storage model.
2. Confirmed write pipeline.
3. Pending memory candidate pipeline.
4. Context builder.
5. Project restore interface.
6. Source sync interface.
7. Conflict/stale detection.
8. Memory diagnostics.
9. Trace log for every write attempt.
10. Clear source-of-truth rules.

---

## 11. Design rule

Project Memory is continuity support, not the brain.

Correct:

```text
Project Memory stores confirmed project context.
Pillars define laws.
Repo/runtime sources verify current facts.
Core orchestrates.
AI explains when explicitly called.
```

Incorrect:

```text
Project Memory invents project facts.
Project Memory overrides pillars.
Project Memory writes itself from raw chat.
Project Memory stores secrets or raw logs.
Project Memory becomes Telegram-dependent.
Project Memory becomes a hidden autonomous worker.
```
