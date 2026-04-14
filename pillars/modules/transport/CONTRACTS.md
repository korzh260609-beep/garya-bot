# Transport Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Transport module.
- Fix the adapter-to-core boundary.
- Reduce guessing during future channel integrations.

Status: CANONICAL
Scope: Transport logical interfaces

---

## 0) Contract philosophy

Transport contracts define how platform input enters the system.

This file does not require exact current implementation names.
It defines the contract shape future work must preserve.

If implementation diverges, the divergence must be made explicit.

---

## 1) Canonical boundary

Transport must expose an explicit adapter-to-core handoff boundary.

Canonical logical flow:

raw platform payload
→ transport adapter
→ unified context
→ core message handler

The exact file names may evolve.
The boundary must remain explicit.

---

## 2) Contract set

### 2.1 `receive(rawPayload)`
Purpose:
- accept raw platform input into the transport boundary

Expected input:
- raw platform event/update payload
- transport/platform metadata if needed

Preconditions:
- payload originates from a configured transport source
- payload has at least minimal expected platform shape

Postconditions:
- payload is either normalized further or safely rejected
- malformed payloads do not create uncontrolled side effects

Must NOT do:
- execute business logic
- call memory directly
- decide permissions
- call AI directly for core behavior

---

### 2.2 `normalize(rawPayload)`
Purpose:
- transform raw platform payload into unified context

Expected input:
- raw platform payload

Preconditions:
- payload passed basic structural validation
- required transport fields are extractable or failure is explicit

Postconditions:
- returns normalized transport-safe unified context
- output shape is stable enough for core handling
- missing critical fields produce controlled failure

Must include enough information for core flow, such as:
- platform
- chat/platform identifiers
- user/platform identifiers if present
- message/input text or structured content reference
- transport-level metadata needed for safe handling

Must NOT do:
- invent business semantics
- attach hidden permissions
- silently drop critical input state without explicit policy

---

### 2.3 `toCoreContext(normalizedInput)`
Purpose:
- produce the context expected by the core message pipeline

Expected input:
- normalized transport result

Preconditions:
- input already passed transport normalization
- context shape is internally coherent

Postconditions:
- core handler receives one unified context shape
- core does not need to understand raw platform payloads directly

Must NOT do:
- bypass the canonical core entry
- fork into platform-specific business logic branches

---

### 2.4 `handoff(coreContext)`
Purpose:
- pass normalized context into the core handler

Expected input:
- unified core context

Preconditions:
- context is normalized
- transport-specific side effects are already bounded

Postconditions:
- one core processing path starts
- control leaves transport responsibility zone

Must NOT do:
- apply post-handoff hidden mutations to core meaning
- continue business branching after handoff

---

## 3) Idempotency / retry contract

Transport must support safe behavior under retry conditions where relevant.

Examples:
- webhook redelivery
- repeated platform updates
- multi-instance delivery overlap

Expected rule:
- transport must not create uncontrolled duplicate side effects before dedupe protections are considered

This does not mean all dedupe belongs to Transport,
but Transport must not ignore retry reality.

---

## 4) Caller obligations

Callers/integrators of Transport must:

- treat transport as adapter layer only
- preserve the unified context boundary
- avoid embedding business behavior into adapters
- keep channel-specific logic bounded to actual transport needs

Must NOT:
- use transport as a shortcut around core architecture
- let adapters accumulate unrelated responsibilities

---

## 5) Error behavior

Transport should fail in a controlled way when:

- payload is malformed
- required identifiers are missing
- normalization cannot produce a valid context
- platform event type is unsupported
- retry/duplication conditions are unsafe

Preferred behavior:
- explicit rejection
- structured logging/diagnostics
- bounded failure without partial business execution

Forbidden behavior:
- silent mutation of meaning
- uncontrolled partial execution
- adapter-side business fallback

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- direct business branching inside webhook/controller layer
- direct Memory writes in adapters
- direct permission checks as core replacement
- direct AI calls from transport for core behavior
- storing long-term business state inside transport components
- building separate logic worlds per channel

---

## 7) Future contract expansion

Future additions may include contracts for:

- Discord adapter
- email adapter
- web/api adapter
- richer structured input types
- transport-level diagnostics
- transport-level dedupe keys

These additions must preserve the same principles:
- thin
- bounded
- explicit
- platform-specific only where necessary

---

## 8) Final rule

Transport contracts exist to stop channel integration from damaging core architecture.

If adapters become a second hidden core,
the system will fragment.