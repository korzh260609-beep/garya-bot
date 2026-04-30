# Bot Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Bot module.
- Fix the handler/dispatch boundary.
- Keep the conversational shell aligned with `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Bot logical interfaces

---

## 0) Contract philosophy

Bot contracts define how user-facing input enters SG through a channel-facing shell.

The Bot module is not SG itself.
It is not the brain of SG.
It is an interface/entry component of the global SG system.

Canonical rule:

```text
SG is free in thinking.
SG is controlled in actions.
```

Therefore Bot may route, normalize, dispatch and format.
Bot must not independently own SG identity, philosophy, governance, permissions, memory policy, source policy or final action authority.

This file does not require exact current implementation names.
It defines the contract shape future bot work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Bot-related behavior must go through an explicit dispatch boundary.

Canonical logical flow may look like:

```text
transport/core context
-> dispatcher / minimal routing boundary
-> one chosen handler path
-> owning module/service
-> permission/gate/confirmation where needed
-> formatted response
```

The exact file/function names may evolve.
The dispatch boundary itself must remain explicit.

Bot handlers are entry points, not hidden systems.

---

## 2) Contract set

### 2.1 `dispatch(context)`
Purpose:
- choose the correct handler path for incoming normalized user-facing context

Expected input:
- normalized context
- command/text metadata
- routing hints if available

Preconditions:
- input already passed transport/core normalization
- enough context exists to decide handler path or controlled fallback

Postconditions:
- exactly one bounded route/handler path is chosen or explicit fallback occurs
- routing remains reviewable
- action type is not hidden if the route may become state-changing, external, private-data, or costly

Must NOT do:
- execute unrelated deep business logic inline
- silently fork into hidden complex behavior
- act as a heavy SemanticRouter / SG brain replacement
- bypass permission/gate/confirmation requirements

---

### 2.2 `handle(context, ...)`
Purpose:
- perform one handler-level entry action for a chosen route

Expected input:
- normalized context
- route-specific lightweight arguments

Preconditions:
- dispatch already selected this handler path
- access/validation requirements are either already applied or explicitly called

Postconditions:
- delegates real work to owning module/service where required
- returns bounded result for response formatting
- preserves read-only / analysis-only / prepare-only / state-changing distinction

Must NOT do:
- become full owner of unrelated business logic
- bypass module boundaries
- silently decide access policy if it belongs elsewhere
- write memory, repo, tasks or external systems without explicit permitted path

---

### 2.3 `formatResponse(result, context?)`
Purpose:
- convert bounded result into user-facing output shape

Expected input:
- result payload
- optional user/context formatting info

Preconditions:
- result already exists
- formatting scope is known enough

Postconditions:
- user gets readable bounded output
- formatting remains separate from deeper business semantics where possible
- visible risks, failures, source limits and confirmation needs are not erased

Must NOT do:
- mutate business meaning invisibly
- hide critical failure/risk context that must remain visible
- make uncertain source/model output look stronger than justified

---

### 2.4 `fallback(context)`
Purpose:
- provide controlled fallback when routing or feature entry is unclear/unavailable

Expected input:
- normalized context

Preconditions:
- no primary route can be safely resolved or executed

Postconditions:
- produces bounded user-facing fallback
- no unsafe hidden branching occurs
- no state-changing action occurs under fallback cover

Must NOT do:
- guess deeply without module support
- perform hidden feature execution under fallback cover
- fabricate source-backed facts when sources are unavailable

---

## 3) Caller obligations

Any caller using Bot must:

- provide normalized context
- keep routing explicit
- treat handlers as bounded entry points
- delegate to owning modules for real logic
- call permission/gate/confirmation checks before protected actions

Caller must NOT:
- stuff unrelated business behavior into handlers
- assume the chat entry layer is the correct owner of deep logic
- use Bot as a shortcut around module boundaries
- treat Bot command access as governance authority

---

## 4) Side effects

Bot operations may have side effects such as:

- command/route selection
- handler invocation
- response generation
- logs/telemetry hooks

These side effects must remain explicit and predictable.

Bot must not perform hidden state-changing side effects.

---

## 5) Error behavior

Bot operations should fail in a controlled way when:

- route cannot be resolved
- handler input is invalid
- delegated module returns failure
- required access is denied
- required module/runtime dependency is unavailable
- source/model/file extraction limits prevent a trustworthy answer

Preferred behavior:
- explicit fallback or failure response
- readable operator/user outcome
- bounded delegation behavior

Forbidden behavior:
- handler-local silent policy invention
- partial uncontrolled execution
- deep hidden fallback that changes feature meaning
- confident output from missing source evidence

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- large business logic blobs inside handlers
- direct provider logic inside bot routing files
- direct permission bypass in handler special cases
- direct memory semantics in unrelated bot handlers
- treating response formatting as permission to alter deeper logic silently
- treating Bot as SG, as SG brain, or as governance owner

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer conversational routing
- callback/action surfaces
- admin command surfaces
- group-chat reply routing
- command metadata schemas

These additions must preserve the same principles:
- explicit
- bounded
- delegation-first
- reviewable
- controlled for actions, free for thinking

---

## 8) Final rule

Bot contracts exist to keep the conversational shell readable and controlled.

If handlers turn into hidden mini-systems,
future work becomes unsafe and expensive.

Bot is an SG interface component, not SG itself.