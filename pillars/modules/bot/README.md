# Bot Module — README

Purpose:
- Define the Bot module as a stable responsibility domain.
- Fix what belongs to command routing, handlers, and conversational entry flow.
- Prevent bot handlers from becoming a hidden god-layer.

Status: CANONICAL
Scope: Bot logical module

---

## 0) Module purpose

The Bot module is responsible for:

- receiving normalized user-facing input from transport/core entry
- parsing commands or conversational intent entry surfaces
- dispatching to the correct handler/module
- formatting bounded user-facing responses
- acting as the conversational shell of SG

This module exists to connect user interaction with the rest of the system without owning the full business logic.

---

## 1) In scope

Bot includes responsibilities such as:

- command routing
- handler dispatch
- lightweight input branching
- response formatting
- user-facing command/help surfaces
- delegating work to owning modules

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

Also out of scope:
- becoming a “god-controller”
- collecting random miscellaneous logic because the chat starts here

---

## 3) Core idea

Bot is the user-facing orchestration shell.

It should answer:
- what kind of input is this?
- which handler or module should receive it?
- what response shape should be shown?

It should NOT answer:
- how the whole system works internally

That distinction must remain hard.

---

## 4) Core responsibilities

The Bot module is responsible for:

1. routing commands/input into the correct handler path
2. keeping handlers small and bounded
3. delegating real logic to owning modules
4. formatting clear user-facing outputs
5. keeping user entry flow readable and reviewable

---

## 5) Hard invariants

The following invariants must hold:

- handlers remain thin
- handlers delegate real logic outward
- bot entry flow remains readable
- bot must not silently own unrelated business policy
- bot must not bypass access/memory/source boundaries
- command routing must remain explicit enough to review

---

## 6) Examples of what Bot may do

Allowed examples:

- map `/price` to a source-backed handler
- map `/recall` to recall flow entry
- parse command arguments lightly
- choose response formatting style
- call the correct module/service
- display bounded result to user

These are bot responsibilities.

---

## 7) Examples of what Bot must not do

Forbidden examples:

- direct SQL-heavy logic inside handlers
- permission policy invented per handler
- source/provider logic implemented in command files
- memory semantics decided ad hoc in chat handler
- raw transport parsing mixed into bot logic
- AI routing decided inconsistently per handler without central policy

These create hidden architecture damage.

---

## 8) Relationship to adjacent modules

Bot is closely related to:

- Transport
- Users / Access
- Memory
- Sources
- Tasks
- Repo
- Logging / Diagnostics
- AI Routing

But Bot does not own those modules.

It is the user-facing entry and delegation layer.

---

## 9) Ownership rule

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

then it belongs elsewhere.

---

## 10) Final rule

Bot exists to connect the user to SG, not to absorb SG.

If handlers become the place where “everything happens”,
the architecture stops being modular.