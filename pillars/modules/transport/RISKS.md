# Transport Module — RISKS

Purpose:
- Document the main risk surface of the Transport module.
- Prevent adapter creep, channel identity confusion and platform-driven architecture damage.
- Keep channel integration predictable and aligned with `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Transport module risk model

---

## 0) Why this file matters

Transport failures are dangerous because they often start as “small platform-specific exceptions”.

Then over time Transport begins to absorb:
- business logic
- permission logic
- feature behavior
- hidden branching

At that point architecture stops being layered.

This file exists to make that risk visible.

Transport is a channel adapter boundary.
It is not SG itself, not SG brain and not a second core.

---

## 1) Primary risks

### R-01: Transport becomes fat
Description:
- adapters accumulate business logic
- controllers/webhooks become semi-core

Consequence:
- architecture fragmentation
- harder testing
- duplicate logic across channels
- channel-specific bugs

Signal:
- adapter files grow large
- business conditions appear in transport layer

---

### R-02: Platform-specific behavior bypasses core
Description:
- one channel gets custom behavior inside transport
- core is no longer the single source of execution logic

Consequence:
- inconsistent behavior between channels
- hidden bugs
- harder future multi-channel expansion

Signal:
- Telegram path behaves differently without core-level reason
- core handler is skipped or partially replaced

---

### R-03: Transport starts owning permissions
Description:
- role/access rules are embedded into adapters

Consequence:
- access model fragments
- security reasoning gets harder
- permission bugs become channel-specific

Signal:
- platform adapters contain role-specific business decisions

---

### R-04: Transport starts owning memory behavior
Description:
- adapters write memory directly or decide memory semantics

Consequence:
- memory boundaries break
- duplication and policy drift appear
- hidden context corruption

Signal:
- direct memory writes from transport code
- adapter-local memory exceptions

---

### R-05: Retry/idempotency is ignored
Description:
- webhook retries or duplicate deliveries produce repeated side effects

Consequence:
- duplicate processing
- repeated outputs
- polluted logs/memory/tasks
- hard-to-debug race behavior

Signal:
- duplicate message handling
- unexplained repeated effects

---

### R-06: Unified context drifts by channel
Description:
- different adapters produce inconsistent core contexts

Consequence:
- core logic becomes unstable
- future handlers depend on channel quirks
- debugging becomes harder

Signal:
- “works in Telegram, breaks in another channel” without true business reason

---

### R-07: Transport is mistaken for SG
Description:
- Telegram/Discord/Web adapter is treated as the system identity or capability boundary

Consequence:
- SG gets reduced to one channel
- multi-transport architecture becomes harder
- “no command in this channel” is wrongly treated as “SG cannot do it”

Signal:
- docs/code imply Bot/Telegram/channel = SG

---

### R-08: Platform identity is mistaken for global identity
Description:
- Telegram ID / Discord ID / chat ID is treated as full global identity or authorization

Consequence:
- user isolation weakens
- cross-transport identity linking becomes unsafe
- permissions become channel-dependent

Signal:
- platform user id directly grants long-term/project permissions without identity/access boundary

---

### R-09: Transport starts calling AI/sources/tasks directly
Description:
- adapter layer initiates AI calls, source fetches or task execution instead of handing off to core/owning modules

Consequence:
- hidden business behavior
- inconsistent governance
- harder diagnostics

Signal:
- webhook/controller code calls AI/source/task modules directly for feature behavior

---

## 2) Secondary risks

### R-10: Hidden payload assumptions
Consequence:
- malformed events crash or misroute handling

### R-11: Silent field dropping
Consequence:
- important context disappears without trace

### R-12: Over-normalization
Consequence:
- channel-specific useful metadata is lost too early

### R-13: Under-normalization
Consequence:
- raw platform mess leaks into core

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is just a small Telegram exception”
- “we can handle this case directly in webhook code”
- “one role check in adapter is harmless”
- “we will unify later”
- “this platform is special”
- “thin transport is optional”
- “Telegram is basically SG for now”
- “platform user id is enough identity”
- “calling AI directly from adapter is faster and fine”

These assumptions must be treated as early warning signs.

---

## 4) Regression checks after Transport changes

After any meaningful Transport change, verify:

1. adapters still hand off into one core path
2. transport files did not absorb business logic
3. permission logic did not leak into transport
4. memory logic did not leak into transport
5. retry/duplicate conditions remain bounded
6. unified context shape remains stable
7. docs still match actual transport behavior
8. transport/channel is not treated as SG itself
9. platform identity is not treated as full authorization
10. transport does not call AI/sources/tasks directly for feature behavior

---

## 5) Risk handling strategy

Preferred defenses:

- explicit adapter boundary
- stable unified context shape
- clear handoff into core
- bounded transport responsibility
- transport diagnostics/logging
- identity-linking discipline
- early detection of adapter growth

Avoid fake safety:
- channel exceptions hidden in transport
- silent “temporary” branching
- undocumented transport-specific behavior
- treating Telegram/Bot constraints as SG constraints
- platform-id shortcuts around global identity/access

---

## 6) Highest-priority rule

The most dangerous Transport bug is not a crash.

The most dangerous bug is:
“the channel still works, but now business logic lives in the adapter.”

That silently destroys layered architecture.

A second critical bug is:
“a transport/channel is treated as SG itself instead of a delivery surface.”