# Project Memory Module — README

Purpose:
- Define the Project Memory module as a stable responsibility domain.
- Fix what belongs to persistent project-context storage and restoration.
- Prevent project-level context from being mixed with ordinary memory or pillars.

Status: CANONICAL
Scope: Project Memory logical module

---

## 0) Module purpose

The Project Memory module is responsible for:

- storing persistent project-level context
- restoring project-specific state for future work
- preserving structured project continuity
- keeping project context separate from ordinary chat memory
- supporting project-aware workflows without replacing canonical pillars

This module exists to help SG continue project work coherently across sessions and development blocks.

---

## 1) In scope

Project Memory includes responsibilities such as:

- project section storage
- project context retrieval
- project-scoped restoration helpers
- structured project notes/state
- bounded project continuity helpers

Typical related code areas may include:
- project memory storage layer
- project section read/write helpers
- project restoration helpers
- project-context loaders

---

## 2) Out of scope

The Project Memory module must NOT own:

- canonical project governance
- global architecture rules
- transport parsing
- permission policy
- ordinary long-term user memory semantics
- raw repository indexing
- general chat-history storage

Also out of scope:
- replacing `pillars/`
- becoming a random dump for everything “about the project”

---

## 3) Core idea

Project Memory must answer:

- what project-level context should survive across sessions?
- what structured project state can be restored later?
- what belongs to project continuity rather than ordinary memory?

Important distinction:

- Pillars = canonical governance and rules
- Project Memory = persistent project working context
- Ordinary Memory = reusable semantic memory
- Chat History = historical dialogue/log layer

These must not be mixed casually.

---

## 4) Core responsibilities

The Project Memory module is responsible for:

1. storing structured project context
2. reading/restoring project context
3. keeping project continuity bounded and useful
4. preserving separation from pillars and ordinary memory
5. supporting project-aware future work without replacing canonical docs

---

## 5) Hard invariants

The following invariants must hold:

- Project Memory must not replace pillars as source of truth
- project context must remain structured enough to restore usefully
- project memory must remain distinct from ordinary chat memory
- project memory must not become a generic garbage dump
- restoration must remain bounded and reviewable
- canonical rules still belong to pillars

---

## 6) Relationship to pillars

Project Memory is supportive, not canonical.

That means:

- accepted rules, decisions, architecture boundaries belong in pillars
- project memory may store project working context, summaries, active project state, and structured continuity data
- conflicts must resolve in favor of verified repository/runtime + canonical pillars

This distinction must remain hard.

---

## 7) Relationship to adjacent modules

Project Memory is closely related to:

- Memory
- Bot
- Logging / Diagnostics
- Repo
- Tasks

But Project Memory does not own those modules.

It owns project-scoped continuity context.

---

## 8) Examples of what Project Memory may do

Allowed examples:

- store project section state
- restore active project context
- keep structured notes on project work
- support project continuity across sessions
- separate project context from generic memory

These are project-memory responsibilities.

---

## 9) Examples of what Project Memory must not do

Forbidden examples:

- override canonical pillars
- store random unrelated chat scraps indefinitely
- act as a full repository archive
- replace ordinary memory contracts
- decide governance by convenience

These break project context integrity.

---

## 10) Ownership rule

If the question is:
- what project-specific context should persist
- how to restore project continuity
- how project sections are structured/retrieved
- how to separate project continuity from other memory layers

it belongs here.

If the question is:
- what the canonical project rules are
- how ordinary user memory works
- how chat history is logged
- how repository structure is indexed

then it belongs elsewhere.

---

## 11) Final rule

Project Memory exists to preserve project continuity without replacing project governance.

If it starts to compete with pillars,
the project loses a clear source hierarchy.