# Bot Module — README

Purpose:
- Define the Bot module as a stable responsibility domain.
- Fix what belongs to command routing, handlers, and conversational entry flow.
- Prevent bot handlers from becoming a hidden god-layer.
- Keep Bot aligned with `pillars/DECISIONS.md` and the controlled-action philosophy.

Status: CANONICAL
Scope: Bot logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The Bot module is responsible for:

- receiving normalized user-facing input from transport/core entry
- parsing commands or conversational intent entry surfaces
- dispatching to the correct handler/module
- formatting bounded user-facing responses
- acting as the current conversational shell/access surface of SG

This module exists to connect user interaction with the rest of the system without owning the full business logic.

Bot is not SG itself.

Correct relation:

```text
SG = global project entity / global intellectual system
Bot = user-facing access/runtime surface and dispatch shell
```

---

## 1) In scope

Bot includes responsibilities such as:

- command routing
- handler dispatch
- lightweight input branching
- response formatting
- user-facing command/help surfaces
- delegating work to owning modules
- respecting Human Mode / Technical Mode boundaries

Typical related code areas may include:
- command dispatcher
- command-to-action map
- handler files
- chat entry handlers
- response-building helpers

---

## 2) Out of scope

The Bot module must NOT own:

- transport/webhook parsing
- access policy itself
- memory policy
- source-fetching logic
- repository indexing logic
- AI routing policy
- deep business logic of unrelated modules
- direct storage orchestration across the whole system
- SG philosophy, identity, governance, or accepted decisions

Also out of scope:
- becoming a “god-controller”
- collecting random miscellaneous logic because the chat starts here
- acting as SG brain

---

## 3) Core idea

Bot is the user-facing orchestration shell.

It should answer:
- what kind of input is this?
- which handler or module should receive it?
- what response shape should be shown?

It should NOT answer:
- how the whole system works internally
- what SG is philosophically
- which protected action may bypass permission/source/risk checks

That distinction must remain hard.

---

## 4) Core responsibilities

The Bot module is responsible for:

1. routing commands/input into the correct handler path
2. keeping handlers small and bounded
3. delegating real logic to owning modules
4. formatting clear user-facing outputs
5. keeping user entry flow readable and reviewable
6. keeping Technical Mode routes separate from Human Mode intelligence

---

## 5) Hard invariants

The following invariants must hold:

- handlers remain thin
- handlers delegate real logic outward
- bot entry flow remains readable
- bot must not silently own unrelated business policy
- bot must not bypass access/memory/source boundaries
- bot must not bypass minimal controller/gate for protected actions
- command routing must remain explicit enough to review
- old phrase/keyword/regex routes must not be presented as Human Mode intelligence

---

## 6) Controlled-action rule

Bot may receive a user request, but Bot does not decide protected execution by itself.

Protected flows must respect:

```text
meaning / command
-> capability
-> permission / scope
-> source/tool need
-> action type
-> risk/cost
-> confirmation if needed
```

Bot must distinguish:

```text
read-only
analysis-only
prepare-only
state-changing
external-action
private-data
expensive/costly
```

Rules:
- permissions protect actions and data, not SG thinking;
- Bot may show denial, warning, explanation, or non-applied plan;
- Bot must not silently perform state-changing or external actions.

---

## 7) Examples of what Bot may do

Allowed examples:

- map `/price` to a source-backed handler
- map `/recall` to recall flow entry
- parse command arguments lightly
- choose response formatting style
- call the correct module/service
- display bounded result to user
- show confirmation prompt for protected actions when the owning flow requires it

These are bot responsibilities.

---

## 8) Examples of what Bot must not do

Forbidden examples:

- direct SQL-heavy logic inside handlers
- permission policy invented per handler
- source/provider logic implemented in command files
- memory semantics decided ad hoc in chat handler
- raw transport parsing mixed into bot logic
- AI routing decided inconsistently per handler without central policy
- protected actions executed only because a handler matched a keyword
- repo mutation/deploy/external sends without explicit permission and confirmation

These create hidden architecture damage.

---

## 9) Relationship to adjacent modules

Bot is closely related to:

- Transport
- Users / Access
- Memory
- Sources
- Tasks
- Repo
- Logging / Diagnostics
- AI Routing
- Minimal Controller / Gate boundary

But Bot does not own those modules.

It is the user-facing entry and delegation layer.

---

## 10) Ownership rule

If the question is:
- how user input enters feature flow
- which handler path is chosen
- how to format the result to the user
- how to keep command/handler entry readable

it belongs here.

If the question is:
- how memory is stored
- how a source is fetched
- whether the user may do it
- how a task is scheduled/executed
- how AI is routed
- whether a protected action is allowed
- what SG is or means

then it belongs elsewhere.

---

## 11) Final rule

Bot exists to connect the user to SG, not to absorb SG.

If handlers become the place where “everything happens”,
the architecture stops being modular.

If Bot becomes SG brain,
the architecture is wrong.