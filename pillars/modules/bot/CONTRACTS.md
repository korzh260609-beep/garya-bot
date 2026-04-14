# Bot Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Bot module.
- Fix the handler/dispatch boundary.
- Reduce guessing during future command and chat entry work.

Status: CANONICAL
Scope: Bot logical interfaces

---

## 0) Contract philosophy

Bot contracts define how normalized user-facing input enters feature execution.

This file does not require exact current implementation names.
It defines the contract shape that future bot work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Bot-related behavior must go through an explicit dispatch boundary.

Canonical logical flow may look like:

core/user-facing context
→ dispatcher/router
→ one chosen handler path
→ owning module/service
→ formatted response

The exact file/function names may evolve.
The dispatch boundary itself must remain explicit.

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

Must NOT do:
- execute unrelated deep business logic inline
- silently fork into hidden complex behavior

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

Must NOT do:
- become full owner of unrelated business logic
- bypass module boundaries
- silently decide access policy if it belongs elsewhere

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

Must NOT do:
- mutate business meaning invisibly
- hide critical failure/risk context that must remain visible

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

Must NOT do:
- guess deeply without module support
- perform hidden feature execution under fallback cover

---

## 3) Caller obligations

Any caller using Bot must:

- provide normalized context
- keep routing explicit
- treat handlers as bounded entry points
- delegate to owning modules for real logic

Caller must NOT:
- stuff unrelated business behavior into handlers
- assume the chat entry layer is the correct owner of deep logic
- use Bot as a shortcut around module boundaries

---

## 4) Side effects

Bot operations may have side effects such as:

- command/route selection
- handler invocation
- response generation
- logs/telemetry hooks

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Bot operations should fail in a controlled way when:

- route cannot be resolved
- handler input is invalid
- delegated module returns failure
- required access is denied
- required module/runtime dependency is unavailable

Preferred behavior:
- explicit fallback or failure response
- readable operator/user outcome
- bounded delegation behavior

Forbidden behavior:
- handler-local silent policy invention
- partial uncontrolled execution
- deep hidden fallback that changes feature meaning

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- large business logic blobs inside handlers
- direct provider logic inside bot routing files
- direct permission bypass in handler special cases
- direct memory semantics in unrelated bot handlers
- treating response formatting as permission to alter deeper logic silently

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

---

## 8) Final rule

Bot contracts exist to keep the conversational shell readable and controlled.

If handlers turn into hidden mini-systems,
future work becomes unsafe and expensive.