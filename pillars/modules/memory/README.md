# Memory Module — README

Purpose:
- Define the Memory module as a stable responsibility domain.
- Clarify what belongs to Memory and what does not.
- Fix the key invariants future code must respect.
- Keep memory aligned with `pillars/DECISIONS.md` and the controlled-action philosophy.

Status: CANONICAL
Scope: Memory logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/modules/project_memory/README.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The Memory module is responsible for:

- long-term memory write/read behavior
- memory selection for context
- memory safety boundaries
- memory deduplication rules
- separation between memory and other storage layers
- preserving reusable user/context facts without uncontrolled dumping

This module exists to keep SG context reusable without turning storage into uncontrolled dumps.

Memory supports SG continuity and experience, but Memory is not SG identity and not SG philosophy source.

---

## 1) In scope

Memory module includes responsibilities such as:

- writing curated memory
- reading memory
- selecting bounded relevant memory context
- applying memory policies
- preventing duplicate memory pollution
- preserving semantic/stable memory usage rules
- separating confirmed memory from archive/digest/history

Typical related code areas may include:
- memory services
- memory policies
- memory data access
- memory selection logic

---

## 2) Out of scope

The Memory module must NOT own:

- transport/platform parsing
- Telegram/web response formatting
- command routing
- permission decisions
- repository indexing structure
- raw repository content archival
- uncontrolled full dialogue dumping into prompts
- SG philosophy, identity, governance, or accepted decisions

Also out of scope:
- replacing canonical pillars
- becoming a generic storage bucket for everything
- acting as a source of truth over verified repo/runtime facts

---

## 3) Key distinctions

### 3.1 Chat history is not confirmed memory
Raw history, archive, digest and curated confirmed memory are not the same thing.

### 3.2 Memory is not project governance
Accepted project rules live in pillars, especially `pillars/DECISIONS.md`, not in Memory.

### 3.3 Memory is not repo archive
Memory must not store raw repository code bodies as reusable memory artifacts.

### 3.4 Memory is not handler-owned
Handlers may use Memory, but must not define Memory rules ad hoc.

### 3.5 Memory is not SG identity
Memory supports SG continuity, but it is a component of SG, not SG itself.

---

## 4) Core responsibilities

The Memory module is responsible for:

1. defining how memory is written
2. defining how memory is read
3. defining how context is selected
4. preventing direct uncontrolled memory usage
5. keeping memory separate from:
   - chat history
   - project memory
   - repo index
   - raw external source payloads
   - logs
   - source cache
6. preserving controlled memory write boundaries

---

## 5) Hard invariants

The following invariants must hold:

- memory access must go through a dedicated memory service layer
- direct ad hoc handler-level memory logic is forbidden
- memory writes must be bounded and policy-aware
- memory writes are state-changing actions unless explicitly classified otherwise
- memory context passed forward must be selected, not dumped
- raw repo code must not become memory content by default
- memory must remain reviewable and predictable
- memory must not override `DECISIONS.md`, root pillars, or verified repo/runtime facts

---

## 6) Controlled-action rule

Memory operations must preserve:

```text
read-only memory retrieval
analysis-only memory use
state-changing memory write/update/delete
private-data memory access
```

Rules:
- memory reads must respect user/project/private scope;
- memory writes must be explicit, bounded, deduped and traceable where appropriate;
- denied memory write may still allow explanation or prepare-only suggestion;
- raw chat must not automatically become durable confirmed memory.

---

## 7) Likely adjacent components

The Memory module is closely related to:

- Bot / handlers
- Users / access
- Project Memory
- Chat History
- Recall Engine
- Logging / diagnostics

But related is not the same as owned.

Memory must remain its own responsibility zone.

---

## 8) Known future expansion direction

Memory may later include or interface with:

- archive layer
- topic digest layer
- confirmed memory layer
- bounded recall helpers
- dedupe heuristics
- diagnostics / quality checks

These expansions must preserve the same boundaries.

---

## 9) Ownership rule

If future code needs long-term reusable context,
that does NOT automatically mean “put it in memory”.

First ask:
- is it memory?
- is it chat history?
- is it project memory?
- is it repo index?
- is it a source cache?
- is it a log?
- is it a pillar/decision that belongs in docs instead?

Wrong placement here creates silent architectural damage.

---

## 10) Final rule

The Memory module exists to preserve reusable context without losing control.

If it becomes a storage dump,
it stops being memory and becomes a liability.

If it starts replacing `DECISIONS.md` or SG philosophy,
the architecture is wrong.