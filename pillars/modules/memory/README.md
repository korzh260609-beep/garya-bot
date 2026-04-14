# Memory Module — README

Purpose:
- Define the Memory module as a stable responsibility domain.
- Clarify what belongs to Memory and what does not.
- Fix the key invariants future code must respect.

Status: CANONICAL
Scope: Memory logical module

---

## 0) Module purpose

The Memory module is responsible for:

- long-term memory write/read behavior
- memory selection for context
- memory safety boundaries
- memory deduplication rules
- separation between memory and other storage layers

This module exists to keep SG context reusable without turning storage into uncontrolled dumps.

---

## 1) In scope

Memory module includes responsibilities such as:

- writing curated memory
- reading memory
- selecting bounded relevant memory context
- applying memory policies
- preventing duplicate memory pollution
- preserving semantic/stable memory usage rules

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

Also out of scope:
- replacing canonical pillars
- becoming a generic storage bucket for everything

---

## 3) Key distinctions

### 3.1 Chat history is not memory
Raw history and curated memory are not the same thing.

### 3.2 Memory is not project governance
Accepted project rules live in pillars, not in Memory.

### 3.3 Memory is not repo archive
Memory must not store raw repository code bodies as reusable memory artifacts.

### 3.4 Memory is not handler-owned
Handlers may use Memory, but must not define Memory rules ad hoc.

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

---

## 5) Hard invariants

The following invariants must hold:

- memory access must go through a dedicated memory service layer
- direct ad hoc handler-level memory logic is forbidden
- memory writes must be bounded and policy-aware
- memory context passed forward must be selected, not dumped
- raw repo code must not become memory content by default
- memory must remain reviewable and predictable

---

## 6) Likely adjacent components

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

## 7) Known future expansion direction

Memory may later include or interface with:

- archive layer
- topic digest layer
- confirmed memory layer
- bounded recall helpers
- dedupe heuristics
- diagnostics / quality checks

These expansions must preserve the same boundaries.

---

## 8) Ownership rule

If future code needs long-term reusable context,
that does NOT automatically mean “put it in memory”.

First ask:
- is it memory?
- is it chat history?
- is it project memory?
- is it repo index?
- is it a source cache?
- is it a log?

Wrong placement here creates silent architectural damage.

---

## 9) Final rule

The Memory module exists to preserve reusable context without losing control.

If it becomes a storage dump,
it stops being memory and becomes a liability.