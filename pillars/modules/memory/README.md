# memory — SG 2.0 Memory Module

> AGENT NOTE:
> This file defines the SG 2.0 memory module boundary.
> Read it before adding chat memory, long-term memory, project memory, group memory, or memory retrieval logic.
> Do not mix user memories, treat raw chat as confirmed memory, or let memory override pillars without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`memory` provides controlled access to remembered context.

---

## Owns

- memory interface;
- memory read/write policies;
- personal memory boundary;
- group memory boundary;
- project memory boundary;
- memory metadata and versioning rules.

---

## Must not own

- raw transport messages;
- AI model selection;
- source truth verification;
- permissions policy ownership;
- task execution.

---

## Hard rule

Memory supports context.
Memory does not replace source-first facts or pillars.
