# SG 2.1 — Personal Result Delivery (RD1) Architecture

Status: ACCEPTED ARCHITECTURE / PLANNED / NOT IMPLEMENTED

## Purpose

Personal Result Delivery (RD1) defines how SG delivers a user-specific result created in a group, channel, private chat, native SG interface or another transport without exposing that result to other participants.

The first practical use case is test/quiz results in Telegram groups. The architecture is deliberately transport-independent so the same contract remains valid when SG has its own interface with native personal chats, groups and channels.

## Core invariant

A personal result belongs to the canonical SG identity (`globalUserId`), not to a Telegram chat, Telegram username or transport-specific account.

```text
Result producer
    ↓
Personal Result Record
    ↓
Personal Delivery Resolver
    ↓
Available private delivery endpoint
    ↓
Transport adapter
    ↓
Owner only
```

No group/channel transport is allowed to expose private result content merely because a private endpoint is unavailable.

## Canonical ownership contract

A personal result must preserve at least:

```text
PersonalResult
- id
- globalUserId
- resultType
- sourceEntityType
- sourceEntityId
- sessionId?
- workspaceId?
- payloadRef / bounded result payload
- status
- createdAt
- completedAt?
```

For tests, `sourceEntityId` is the test identifier and `sessionId` identifies the concrete test session/run.

Transport identifiers such as `telegram_user_id` are resolved through the existing identity binding and are not the canonical owner key.

## Delivery state contract

Delivery state is separate from result correctness/state.

Baseline states:
- `pending` — result exists but has not yet reached a private endpoint;
- `delivered` — successfully delivered to an authorized private endpoint;
- `failed` — delivery attempt failed for a non-terminal reason;
- `expired` — optional policy state for delivery invitations/fallback artifacts, not automatic deletion of the authoritative result.

A failed delivery must never delete, invalidate or recalculate the result.

## Personal Delivery Resolver

RD1 introduces a transport-neutral resolver boundary:

```text
resolvePrivateDelivery(globalUserId, context)
attemptPrivateDelivery(result, endpoint)
markDeliveryState(...)
```

The resolver may consider:
- native SG private chat when available in the future;
- Telegram DM;
- Discord/private transport endpoints;
- future web/app inboxes;
- other explicitly supported private transports.

Transport preference may later be user-configurable, but RD1 must not hard-code Telegram as the permanent canonical destination.

## Telegram adapter behavior

Telegram is the first adapter.

When a test finishes:
1. save the result under `globalUserId`;
2. try Telegram DM if that binding/private conversation is usable;
3. if Telegram rejects bot-initiated delivery because the user has not started the bot, keep the result `pending`;
4. expose a common non-personal group control such as `📩 Получить мой результат`;
5. that control opens SG via a generic deep-link/start payload;
6. after the user starts/opens the bot, Telegram provides the caller identity;
7. SG resolves Telegram identity → `globalUserId`;
8. SG selects only that user’s eligible pending/most-relevant result and sends it privately.

The group message/button may be visible to everyone, but it contains no private result and is not addressed to one participant.

## Generic Telegram fallback

The preferred first-version fallback is a common action, not a per-user token embedded in the group:

```text
/start my_test_result
```

The payload is only an intent marker. Authorization comes from the authenticated Telegram sender identity mapped to `globalUserId`.

The fallback resolver must never trust a user-supplied result ID, score, Telegram username or arbitrary owner ID as proof of ownership.

## Result selection

If a user has multiple results, selection must be deterministic.

Initial policy:
1. prefer an explicitly correlated session when the transport/context safely supplies it;
2. otherwise prefer the newest eligible `pending` result for that `globalUserId`;
3. if ambiguity remains and selecting automatically could expose the wrong context, ask the user to choose from their own results only.

Selection policy must remain replaceable without changing ownership or transport adapters.

## Multi-user isolation

Completion by one participant must not close, overwrite or consume another participant’s test session/result.

Required invariants:
- each participant result has its own owner;
- one user cannot retrieve another user’s result;
- one user completing a test does not close the shared test for others;
- delivery state is per user/result;
- repeated delivery attempts are idempotent where practical;
- public group/channel content never includes private score/details unless the user explicitly chooses a public result mode in a separately accepted feature.

## Native SG interface compatibility

The future SG interface is expected to contain:
- personal chats with SG;
- groups;
- channels;
- transport-independent identity/session continuity.

RD1 must therefore support this path without redesign:

```text
Native SG group/channel test
→ PersonalResult(globalUserId)
→ native private-chat endpoint
→ result appears in the user’s SG private chat
```

Telegram then remains only one adapter/fallback path.

## Relationship to existing systems

- Identity/Global ID: authoritative owner resolution.
- Test/quiz subsystem: authoritative producer/calculator of the result.
- Transport adapters: delivery only; they do not own result semantics.
- Conversation/private chat subsystem: may expose an eligible private endpoint.
- Action Gate/permissions: remain authoritative for protected actions; RD1 does not grant access.
- Membership/subscription: may control whether a user can participate, but does not redefine result ownership.
- Lifecycle Activity/Observability: may record meaningful delivery events/failures without copying private result content.

## Privacy and security requirements

- never expose private result payload in a shared group/channel fallback message;
- never authorize result access by username/display name;
- bind ownership to `globalUserId`;
- validate transport identity mapping on every fallback retrieval;
- avoid placing scores/results in deep-link payloads;
- do not reveal existence/details of another user’s result;
- log only bounded delivery metadata, not unnecessary private content.

## Non-goals for RD1

RD1 does not redesign:
- test question/answer logic;
- scoring;
- test authoring;
- membership/subscription rules;
- global identity architecture;
- transport architecture;
- group visibility rules imposed by Telegram;
- future native UI itself.

RD1 is a delivery/ownership extension around existing result-producing capabilities.
