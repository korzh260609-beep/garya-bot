# Transport Module — README

Purpose:
- Define the Transport module as a stable responsibility domain.
- Fix what Transport is allowed to do and what it must never do.
- Prevent platform adapters from absorbing business logic.

Status: CANONICAL
Scope: Transport logical module

---

## 0) Module purpose

The Transport module is responsible for:

- receiving platform-specific input
- normalizing incoming platform payloads
- converting them into unified context
- passing that context into the core flow safely

Transport exists to isolate platform differences from the rest of SG.

---

## 1) In scope

Transport includes responsibilities such as:

- webhook/input reception
- adapter-level parsing of platform payloads
- extraction of platform message metadata
- normalization into unified context shape
- safe handoff into core message handling
- transport-level idempotency hooks where required

Typical related code areas may include:
- transport adapters
- webhook bridge code
- unified context builders
- adapter-to-core transformation code

---

## 2) Out of scope

The Transport module must NOT own:

- business logic
- permissions logic
- role decisions
- memory write/read policy
- source-fetching policy
- AI routing policy
- long-term storage semantics
- module-specific product behavior

Also out of scope:
- becoming a second bot/business layer
- platform-specific hidden rules that bypass core logic

---

## 3) Core idea

Transport must be:

- thin
- predictable
- stateless
- replaceable

A platform switch must not require rewriting core system logic.

That is the whole point of Transport.

---

## 4) Core responsibilities

The Transport module is responsible for:

1. receiving raw platform payloads
2. validating minimal payload shape
3. extracting transport-safe metadata
4. normalizing into unified context
5. passing normalized context into core flow
6. avoiding duplicate side effects where transport retries can happen

---

## 5) Hard invariants

The following invariants must hold:

- Transport remains thin
- Transport remains stateless
- Transport must not decide business outcomes
- Transport must not own memory behavior
- Transport must not own permission behavior
- Transport must not call AI directly for platform parsing logic
- Channel switch must not create a separate core architecture
- Unified core flow must remain platform-agnostic

---

## 6) Examples of what Transport may do

Allowed examples:

- parse Telegram update
- extract chat/user/message identifiers
- detect message type at transport level
- normalize message into unified context
- pass context into `handleMessage(context)`
- apply transport-level dedupe protection against webhook retries

These are transport responsibilities.

---

## 7) Examples of what Transport must not do

Forbidden examples:

- “if role is monarch then do X here”
- “write memory directly from adapter”
- “run business branching inside webhook layer”
- “call provider/model directly from transport”
- “store platform-specific long-term rules in transport”
- “implement feature behavior only for one channel when it belongs to core”

These create architectural drift.

---

## 8) Relationship to adjacent modules

Transport is closely related to:

- Bot
- Users / Access
- Memory
- Logging / Diagnostics
- Identity resolution

But Transport does not own those modules.

Transport only hands off normalized input.

---

## 9) Future extension rule

Future channels may include:

- Discord
- Web / API
- Email
- others

Adding a new channel must preserve the same rule:

new channel = new adapter
not = new business architecture

---

## 10) Ownership rule

If a problem is platform-specific, it may belong to Transport.

If a problem is about:
- what the system means
- what the user is allowed to do
- how memory is stored
- how AI is called
- how tasks are executed

then it does NOT belong to Transport.

This distinction must stay hard.

---

## 11) Final rule

Transport exists to isolate channels, not to reinvent SG per channel.

If Transport becomes “smart” in the wrong way,
core architecture becomes fragmented and unsafe.