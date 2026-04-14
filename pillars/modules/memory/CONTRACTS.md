# Memory Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Memory module.
- Reduce guessing during future code work.
- Clarify preconditions, postconditions, and forbidden usage patterns.

Status: CANONICAL
Scope: Memory logical interfaces

---

## 0) Contract philosophy

This file defines behavior expectations for the Memory module.

It does NOT require exact current implementation names.
It defines the contract that future code should follow.

If implementation diverges from this contract,
the divergence must be made explicit and documented.

---

## 1) Canonical service boundary

Memory operations must go through a dedicated service boundary.

Canonical logical service:
- `MemoryService`

The exact file/class/function layout may evolve,
but the boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `write(...)`
Purpose:
- persist a memory item that is allowed by memory policy

Expected input:
- actor/user identity or ownership context
- memory content or structured payload
- metadata
- type/category if applicable

Preconditions:
- content is eligible for memory
- content is not forbidden by policy
- write path is authorized by design
- input is bounded / validated

Postconditions:
- memory item is stored or safely rejected
- duplication policy is respected
- result is observable/loggable if needed

Must NOT do:
- store raw uncontrolled dialogue dump as curated memory
- store raw repository source bodies as memory
- silently bypass policy

---

### 2.2 `read(...)`
Purpose:
- retrieve memory items by a defined scope

Expected input:
- identity/scope
- filters if needed
- limit/bounds

Preconditions:
- caller uses service boundary
- scope is explicit
- limits are bounded

Postconditions:
- returns only allowed memory data
- output respects scope and limits
- does not leak unrelated data by default

Must NOT do:
- return uncontrolled bulk dumps
- ignore scope boundaries

---

### 2.3 `context(...)`
Purpose:
- build a bounded memory context for future processing

Expected input:
- current request context
- scope/user/chat info
- optional selection hints
- bounded limits

Preconditions:
- context request is explicit
- limits exist
- source memory is allowed for this use

Postconditions:
- returns selected relevant memory context
- output remains bounded and policy-aware
- irrelevant noise is reduced

Must NOT do:
- dump full memory history blindly
- mix memory with unrelated storage layers without explicit policy

---

### 2.4 `recent(...)`
Purpose:
- retrieve recent memory items within defined limits

Expected input:
- identity/scope
- limit

Preconditions:
- bounded limit
- explicit scope

Postconditions:
- returns recent allowed items only

Must NOT do:
- behave as unbounded history export

---

## 3) Caller obligations

Any caller using the Memory module must:

- use the Memory service boundary
- provide explicit scope
- respect limits
- avoid direct SQL/storage bypass
- avoid inventing local memory policy in handlers

Caller must NOT:
- redefine memory semantics ad hoc
- write memory through side channels
- treat raw chat history as curated memory automatically

---

## 4) Side effects

Memory operations may have side effects such as:

- persistence
- dedupe checks
- selection filtering
- logging/telemetry hooks

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Memory operations should fail in a controlled manner when:

- policy blocks the content
- input is invalid
- scope is missing or ambiguous
- storage failure occurs
- data exceeds limits
- caller attempts forbidden bypass behavior

Preferred behavior:
- explicit rejection
- bounded failure
- observable error path

Forbidden behavior:
- silent partial corruption
- silent fallback into uncontrolled storage
- hidden policy bypass

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- direct handler SQL writes into memory tables
- raw repository code bodies stored as memory by default
- raw chat log dump treated as curated memory
- unbounded prompt-memory injection
- hidden memory semantics implemented outside the memory boundary

---

## 7) Future contract expansion

Future additions may include contracts for:

- archive memory
- digest generation
- topic grouping
- memory cleanup
- memory diagnostics
- explicit memory confirmation flows

These additions must preserve the same principles:
- bounded
- explicit
- policy-aware
- reviewable

---

## 8) Final rule

Memory contracts exist to preserve control.

A memory system without clear contracts becomes a silent source of wrong context and hard-to-detect bugs.