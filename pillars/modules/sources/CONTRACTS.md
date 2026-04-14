# Sources Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Sources module.
- Fix the source-fetching and normalization boundary.
- Reduce guessing during future provider integrations.

Status: CANONICAL
Scope: Sources logical interfaces

---

## 0) Contract philosophy

Sources contracts define how SG obtains real external/internal data safely and predictably.

This file does not require exact current implementation names.
It defines the contract shape that future source work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Source-related operations must go through an explicit source boundary.

Canonical logical capabilities may include:

- fetch source by key/config
- normalize provider payload
- diagnose source status
- enforce source-specific guardrails
- expose bounded source results

The exact file/function names may evolve.
The boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `fetch(sourceKey, ...)`
Purpose:
- fetch data from a configured source

Expected input:
- source identifier/key
- optional fetch parameters within allowed scope

Preconditions:
- source is known/configured
- caller is in an allowed execution path
- required config/runtime prerequisites exist

Postconditions:
- returns fetched source payload or controlled failure
- failure remains explicit and observable
- no silent fabricated data is returned

Must NOT do:
- invent missing data
- hide provider/runtime failure
- silently bypass source configuration

---

### 2.2 `normalize(rawPayload, sourceKey, ...)`
Purpose:
- convert provider-specific payload into bounded normalized form

Expected input:
- raw source payload
- source identifier/type
- normalization context if needed

Preconditions:
- fetch result exists or equivalent raw payload is available
- source type/provider is explicit enough for correct normalization

Postconditions:
- returns normalized representation or controlled failure
- downstream layers do not need to reason from raw provider mess where normalization is required

Must NOT do:
- mix provider semantics invisibly
- hide important missing/invalid fields
- pretend malformed payload is valid normalized data

---

### 2.3 `diagnose(sourceKey, ...)`
Purpose:
- evaluate source health, status, and failure mode

Expected input:
- source identifier/key
- optional recent run context

Preconditions:
- source is explicit
- enough runtime/diagnostic context exists

Postconditions:
- returns bounded diagnosis/status result
- source failure reason remains reviewable where possible

Must NOT do:
- collapse all source failures into vague generic noise
- hide persistent source restrictions

---

### 2.4 `testSource(sourceKey, ...)`
Purpose:
- perform explicit test/verification of a source connection or fetch path

Expected input:
- source identifier/key
- optional test parameters

Preconditions:
- source is configured/testable
- test surface is allowed by policy

Postconditions:
- returns explicit success/failure/test result
- helps distinguish config/runtime/provider issues

Must NOT do:
- mutate unrelated source state invisibly
- blur testing with business execution

---

## 3) Caller obligations

Any caller using Sources must:

- refer to explicit source identifiers
- handle controlled failure honestly
- respect normalized-vs-raw distinctions
- avoid guessing when the source is unavailable

Caller must NOT:
- treat source failure as permission to fabricate data
- bypass source boundary with ad hoc provider calls everywhere
- assume different providers are interchangeable without normalization

---

## 4) Side effects

Source operations may have side effects such as:

- diagnostics logging
- source run persistence
- cache/index updates if explicitly configured
- rate-limit-related state handling

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Sources operations should fail in a controlled way when:

- source key is unknown
- provider call fails
- runtime cannot access provider
- payload is malformed
- normalization fails
- rate-limit or availability constraints trigger

Preferred behavior:
- explicit failure/diagnostic result
- bounded output
- no silent substitution with guessed data

Forbidden behavior:
- fabricated fallback sold as real data
- hidden provider-switching without policy
- vague generic errors that destroy operator visibility

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- hardcoding ad hoc provider fetches outside source boundary
- skipping normalization where downstream depends on normalized shape
- hiding runtime/provider restrictions
- using AI as implicit parser/replacement for poor source discipline
- silently inventing missing source data

---

## 7) Future contract expansion

Future additions may include contracts for:

- cache-first source access
- richer provider registries
- source-specific quotas/rate-limits
- multi-provider fusion prep
- file/document-based sources
- group/chat history as sources

These additions must preserve the same principles:
- explicit
- normalized
- failure-visible
- source-first

---

## 8) Final rule

Sources contracts exist so SG can rely on real data with explicit limits.

If source contracts become vague,
the rest of the system starts reasoning on uncertainty disguised as data.