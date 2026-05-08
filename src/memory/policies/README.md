# SG 2.0 Memory Policies

> AGENT NOTE:
> This folder owns deterministic memory/context policy skeletons.
> Do not add DB reads/writes, AI calls, transport logic, source fetching, or repo writes here without explicit Monarch approval.
> Policies must protect Living SG behavior, source-first facts, privacy, attribution, transport independence, and unified user memory by global identity.

Status: SKELETON

---

## Purpose

`src/memory/policies/` defines safety and boundary policies for SG memory and AI context.

Policies decide what is allowed, blocked, or requires approval before memory/context runtime is connected.

---

## Global user memory rule

Every real user must have one stable `global_user_id`.

User memory must be unified across all transports by `global_user_id`.

The same human user must have one memory space across:

- Telegram;
- web;
- API;
- GitHub/Codex bridge;
- IDE tools;
- CLI;
- future transports.

Transport-specific identifiers are only input signals for identity resolution.

They are not the owner of long-term user memory.

Rule:

```text
transport_user_id -> identity resolver -> global_user_id -> unified user memory
```

Required:

- one `global_user_id` per verified human user;
- one unified user memory space per `global_user_id`;
- transport-specific IDs mapped to the same `global_user_id` only through verified linking;
- memory reads/writes use `global_user_id` as the long-term user owner;
- missing or unverified identity must fail closed or stay session-only.

Forbidden:

- storing long-term user memory only by Telegram chat id;
- storing separate long-term memories for the same user per transport;
- treating Telegram `chat_id`, Telegram `user_id`, web session id, API token id, GitHub id, IDE id, or CLI id as universal memory owner by itself;
- merging identities automatically without a verified linking policy;
- mixing memories of users who share a group chat;
- allowing group memory to become personal memory without attribution.

---

## Transport independence

Memory policies are transport-independent.

Telegram is only one channel.

Future transports must pass through the same memory contracts and identity rules.

The AI model inside SG must receive context based on SG identity and `global_user_id`, not on a single transport implementation.

---

## Policy files

```text
rawPromptPolicy.js
projectMemoryPolicy.js
confirmedMemoryPolicy.js
groupMemoryPolicy.js
```

---

## Hard rules

```text
raw chat != confirmed memory
project memory != pillars/repo/runtime facts
global_user_id owns unified user memory
transport id != global memory owner
same user across transports -> same global_user_id -> same memory
group memory != personal memory
memory != technical mode
memory != command router
```
