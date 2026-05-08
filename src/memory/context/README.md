# SG 2.0 Memory Context

> AGENT NOTE:
> This folder owns the skeleton for building controlled AI context packs.
> Do not put Telegram logic, AI provider calls, DB writes, source fetching, or permission ownership here without explicit Monarch approval.
> Context building must stay bounded, deterministic, and source-first.

Status: SKELETON

---

## Purpose

`src/memory/context/` defines how SG prepares context for the AI model.

The AI model must receive a structured context pack, not a random dump of chat history, raw logs, repository files, or memory rows.

---

## Main rule

```text
collect facts -> normalize -> classify -> limit -> build context pack -> pass to AI layer
```

Forbidden:

```text
raw chat/logs/repo dump -> prompt
```

---

## Context pack may include

- current user message;
- user identity and role;
- active task intent;
- project memory facts;
- current repo/runtime facts;
- relevant session context;
- relevant confirmed user memory;
- source facts with priority labels;
- permission/risk state;
- uncertainty notes.

---

## Context pack must not include by default

- uncontrolled raw dialogue archive;
- unrelated user memories;
- group messages without attribution;
- secrets;
- raw env values;
- huge repository dumps;
- stale facts presented as current truth;
- unverified memory as source truth.

---

## Source priority

For project work, context must respect this priority:

```text
1. pillars / laws
2. repository files from current branch
3. runtime reports
4. commits / PRs / Actions / Render facts
5. confirmed project memory
6. session context
7. raw chat fragments only through approved bounded restore
```

Memory supports context.
Memory does not override verified sources.

---

## First skeleton files

```text
contextTypes.js
contextPackBuilder.js
```

These files define structure only.
They must not connect to DB, Telegram, Render, GitHub, or OpenAI directly.

---

## Failure rule

If context is incomplete, SG must produce a smaller honest context pack with warnings.

It must not invent missing facts.
