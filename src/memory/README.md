# SG 2.0 Memory + Context

> AGENT NOTE:
> This folder is the future implementation home for SG 2.0 memory and AI context logic.
> Do not turn this folder into a monolith.
> Do not move transport, permissions, sources, billing, or AI model selection logic here without explicit Monarch approval.
> Start with skeletons, contracts, and boundaries before runtime code.

Status: SKELETON

---

## Purpose

`src/memory/` is the bounded implementation area for all SG memory and context mechanics.

Memory and context help SG understand the user, the project, prior decisions, and relevant facts.

Memory must support reasoning, not replace verified sources, pillars, permissions, or repository facts.

---

## Core principle

```text
context first -> project memory -> user memory -> group memory -> long-term memory evolution
```

The first implementation direction is:

```text
1. AI context pack
2. Project memory
3. Session context
4. Confirmed user memory
5. Raw dialogue archive
6. Topic digest
7. Recall / restore
8. Group memory
9. Diagnostics and safety guards
```

---

## Memory layers

### 1. AI Context Pack

The AI model must receive a controlled context package, not random raw history.

The context pack may include:

- current user message;
- user identity and role;
- current project state;
- project memory facts;
- relevant session context;
- relevant confirmed user memory;
- verified source facts;
- explicit risk/permission state.

It must not include uncontrolled raw dialogue by default.

---

### 2. Project Memory

Project memory stores confirmed SG project facts.

Examples:

- architecture decisions;
- approved workflow rules;
- active branch rules;
- module boundaries;
- implementation status;
- rollback points;
- known risks;
- project-specific terminology.

Project memory must be source-first.

Repository files, pillars, runtime reports, commits, PRs, Actions, and Render facts outrank memory.

---

### 3. Session Context

Session context is short-lived conversation state.

It helps SG understand the current task without treating temporary chat as confirmed long-term memory.

---

### 4. Confirmed User Memory

Confirmed user memory stores stable user-specific facts.

It must not be created from raw chat automatically without a clear policy.

Confirmed memory needs metadata:

- owner;
- scope;
- source;
- confidence;
- created_at;
- updated_at;
- version;
- expiration or review policy when needed.

---

### 5. Raw Dialogue Archive

Raw dialogue archive may store original messages for restoration, audit, or future summarization.

It must not be prompt-facing by default.

Raw archive can only enter AI context through a bounded restore path.

---

### 6. Topic Digest

Topic digest stores compact summaries of repeated or long conversations.

Digest is not the same as confirmed memory.

A digest may help recall a topic, but confirmed facts must remain separated.

---

### 7. Recall / Restore

Recall restores relevant context by topic, time, project area, or explicit user request.

Recall must be bounded by size, privacy scope, and relevance.

---

### 8. Group Memory

Group memory must never mix personal memories of different users.

Group memory stores only shared group facts and decisions with attribution rules.

---

## Hard rules

```text
raw chat != confirmed memory
memory != source of truth
project memory != pillars replacement
context pack != raw dump
Telegram != memory owner
MemoryService != monolith
```

---

## Boundaries

This folder may own:

- memory interfaces;
- context pack builder;
- project memory service;
- session context service;
- confirmed memory service;
- raw archive service;
- topic digest service;
- recall service;
- memory policies;
- memory diagnostics.

This folder must not own:

- Telegram adapter logic;
- AI provider/model selection;
- permissions ownership;
- source fetching ownership;
- billing ownership;
- task execution ownership;
- repo write actions.

---

## Implementation plan

### Step 1 — Context skeleton

Create contracts for a controlled AI context pack.

Expected output:

```text
src/memory/context/contextPackBuilder.js
src/memory/context/contextTypes.js
```

No DB writes at this step.

---

### Step 2 — Project memory skeleton

Create project memory boundaries and read interface.

Expected output:

```text
src/memory/project/projectMemoryService.js
src/memory/project/projectMemoryTypes.js
```

Project memory must initially be read-only or prepare-only.

---

### Step 3 — Memory contracts

Define public contracts before real runtime logic.

Expected output:

```text
src/memory/contracts.js
```

Contracts must describe:

- inputs;
- outputs;
- ownership;
- privacy scope;
- source priority;
- failure behavior.

---

### Step 4 — Memory policies

Add deterministic policies before automatic memory writes.

Expected output:

```text
src/memory/policies/rawPromptPolicy.js
src/memory/policies/projectMemoryPolicy.js
src/memory/policies/confirmedMemoryPolicy.js
src/memory/policies/groupMemoryPolicy.js
```

---

### Step 5 — Minimal runtime connection

Only after skeleton, contracts, and policies are clear:

```text
Core Orchestrator -> Memory/Context -> AI Layer
```

No transport-specific memory logic.

---

## Useful ideas from old `main`

The old `main` branch had useful memory concepts:

- `MemoryService` facade;
- adapter-based DB access;
- `chat_memory` v2 metadata;
- confirmed memory separation;
- raw dialogue archive not prompt-facing by default;
- topic digest;
- recall engine;
- raw prompt guard;
- diagnostics.

These ideas may be reused.

Old code must not be copied blindly into SG 2.0.

---

## First priority

The first real work must focus on:

```text
AI Context Pack + Project Memory
```

Reason:

- SG development depends on correct project context;
- the model must understand repo state, pillars, decisions, and workflow;
- user memory and group memory should come after project context is safe.
