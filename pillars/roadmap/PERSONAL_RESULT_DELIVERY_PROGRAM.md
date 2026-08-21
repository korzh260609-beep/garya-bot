# SG 2.1 — Personal Result Delivery (RD1) Program

Status: ACCEPTED / PLANNED / NOT IMPLEMENTED

Canonical architecture: `../architecture/PERSONAL_RESULT_DELIVERY.md`.

## Goal

Deliver user-specific results privately across current and future SG transports, using `globalUserId` as the owner key and Telegram DM/deep-link only as the first adapter/fallback.

## RD1.1 — Global Result Ownership

Scope:
- verify or add canonical result ownership by `globalUserId`;
- preserve test/source/session correlation independently of Telegram identifiers;
- keep delivery state separate from test/scoring state;
- add focused ownership/isolation tests.

Acceptance:
- every personal result has exactly one canonical owner;
- Telegram username/chat ID is not the canonical owner key;
- one participant cannot overwrite or consume another participant’s result;
- existing test scoring behavior remains unchanged.

## RD1.2 — Private Delivery Resolver

Scope:
- add transport-neutral private endpoint resolution;
- define resolver/attempt/state contracts;
- support ordered endpoint candidates without hard-coding Telegram as permanent default;
- reserve native SG private chat and other future transports.

Acceptance:
- result delivery can be invoked without Telegram-specific business logic;
- unavailable endpoint leaves result pending rather than losing it;
- resolver remains additive and replaceable.

## RD1.3 — Telegram Direct DM Delivery

Scope:
- after result completion, attempt Telegram DM when the user binding/private chat is usable;
- classify expected Telegram “bot cannot initiate/private chat unavailable” outcomes as delivery fallback, not test failure;
- persist delivery status/idempotency metadata.

Acceptance:
- existing DM users receive the result automatically;
- failure to DM does not fail or recalculate the test;
- result remains retrievable.

## RD1.4 — Common Group Result Control

Scope:
- expose one non-personal control such as `📩 Получить мой результат` in the test UI/message;
- no participant name, score, result ID or private result is placed in the shared group message;
- the control is reusable by all participants.

Acceptance:
- no per-user result notification spam is required in the group;
- all participants may see the control but it leaks no private result data;
- existing Telegram group visibility constraints are respected.

## RD1.5 — Telegram Start / Deep-Link Fallback

Scope:
- implement generic deep-link/start intent (for example `my_test_result`);
- resolve caller from Telegram sender identity through existing Global ID binding;
- activate/reuse private chat after user Start;
- do not trust caller-supplied result ownership parameters.

Acceptance:
- user with no prior bot DM can open/start SG and receive their result;
- deep-link contains no score/private payload;
- copied/shared link cannot expose another participant’s result.

## RD1.6 — Personal Result Resolver

Scope:
- select the caller’s eligible result by `globalUserId`;
- prefer explicit safe session correlation when available;
- otherwise choose newest eligible pending result;
- if genuine ambiguity remains, show only the caller’s own selectable results.

Acceptance:
- deterministic result selection;
- no cross-user retrieval;
- no guessing across ambiguous foreign/shared contexts.

## RD1.7 — Delivery State & Idempotency

Scope:
- states: `pending`, `delivered`, `failed`, optional `expired` for fallback artifacts;
- successful delivery records timestamp/endpoint metadata;
- repeated `/start` or button use cannot corrupt or duplicate authoritative result state;
- retry behavior remains possible for pending/failed delivery.

Acceptance:
- authoritative result survives delivery failures;
- duplicate callbacks/start commands are safe;
- delivery status is inspectable.

## RD1.8 — Multi-user / Multi-session Isolation

Scope:
- regression coverage for owner/admin/ordinary participant concurrency;
- completion by one participant must not close the shared test for another;
- each participant has independent result/delivery state;
- multiple concurrent tests/sessions remain distinguishable.

Acceptance:
- no participant completion race closes another participant’s flow;
- ordinary members work the same as privileged users for result ownership/delivery, subject only to existing participation permissions;
- session crossover is prevented.

## RD1.9 — Native SG Interface Compatibility Contract

Scope:
- reserve/support native private-chat endpoint type in delivery resolver;
- ensure result storage and selection do not depend on Telegram fields;
- document native group/channel → native private chat delivery path;
- no native UI implementation required yet.

Acceptance:
- adding SG native interface later requires a transport/endpoint adapter, not result schema redesign;
- same `globalUserId` result can be delivered through native private chat.

## RD1.10 — Observability, Tests & Exact-HEAD CI

Scope:
- unit/integration/persistence tests for ownership, fallback, selection, isolation and idempotency;
- bounded observability for delivery success/fallback/failure without private result payload leakage;
- canonical docs synchronization;
- exact-head CI verification.

Acceptance:
- regression suite green;
- no private result content in shared logs/events;
- canonical architecture/program/code agree;
- stage is not marked closed without exact-head CI evidence.

## Recommended implementation packages

```text
Package A: RD1.1–RD1.3
  ownership + resolver + direct DM

Package B: RD1.4–RD1.7
  common button + deep-link/start + personal selection + delivery state

Package C: RD1.8–RD1.10
  concurrency/isolation + native-interface contract + tests/CI/docs
```

## Implementation constraints

- extend existing test/result, identity, conversation and transport seams instead of creating a parallel bot-specific subsystem;
- prefer additive PostgreSQL migration only if existing result schema cannot represent the required ownership/delivery metadata;
- do not introduce a new database, queue, worker or microservice;
- do not put result content or user ownership data into public Telegram button text/deep-link payload;
- do not change test scoring/question semantics as part of RD1;
- preserve current multi-transport SG architecture.

## Closure policy

Each RD1 stage is CLOSED only after implementation + focused tests + exact-head CI evidence. Architecture/program text alone means PLANNED, not implemented.
