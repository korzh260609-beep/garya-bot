# SG 2.1 ROADMAP — BLOCK 8.1: DISCORD TRANSPORT INTEGRATION

## Purpose

Extend the completed Block 8 transport foundation with a real production Discord connection while preserving one shared SG core.

Discord is not a separate SG instance, identity system, memory subsystem, AI stack or permission model. It is an additional production transport connected to the same canonical Identity/Scope, Memory 2.0, Semantic Kernel, Decision Engine, Action Gate, Capability System, Delivery Router and Observability layers already used by SG.

Block 8.1 does not renumber Blocks 9–19 and does not replace Block 14 Telegram Production Integration. It is a production extension of Block 8 Interfaces.

## Existing baseline

The Block 8 foundation already provides:

- common `TransportAdapter` contract;
- centralized `InterfaceRegistry`;
- `createDiscordTransportAdapter()` normalization into canonical SG input;
- Discord platform user/channel/guild facts passed to centralized Identity/Scope resolution;
- transport-independent response handling;
- tests proving Discord and Web/API share the same SG core contract.

This existing adapter is a contract-level transport adapter, not a complete production Discord integration. Block 8.1 adds the missing live connection, identity linking, delivery, persistence, diagnostics and production evidence.

## Core invariant

```text
Telegram ─┐
Discord ──┼→ Transport Layer → Identity/Scope → SG Core → Delivery Router
Web/API ──┘
```

There is one SG core and one canonical user identity graph.

A platform account is only an identity link:

```text
Discord platform_user_id
        ↓
identity_links
        ↓
canonical global_user_id
        ↓
roles / grants / settings / Memory 2.0
```

## Non-goals

Block 8.1 must not create:

- a separate Discord SG;
- Discord-specific long-term memory;
- Discord-owned roles or grants;
- Discord-owned semantic routing;
- direct Discord-to-AI calls;
- username/nickname/phrase based owner detection;
- a second authority path around Identity, Scope or Action Gate;
- a second notification policy outside the Delivery Router.

## 8.1.1 Discord production configuration

Add validated production configuration for the Discord application and bot connection.

Required configuration must be centralized through the existing Configuration/Policy, Secrets/Credentials and External Connections layers.

Expected secret/config concepts include:

- Discord bot token;
- Discord application/client identifier;
- optional verified Monarch Discord platform user identifier;
- existing canonical `SG_MONARCH_GLOBAL_USER_ID` as the owner identity anchor;
- Gateway intents and connection policy;
- API timeout/retry/rate-limit policy.

Exact environment variable names are finalized during implementation to avoid duplicate configuration paths.

Raw Discord secrets must never enter Git, ordinary memory, Self Knowledge, prompts, user-visible diagnostics or unrestricted telemetry.

## 8.1.2 Discord Gateway client

Create a production Gateway client responsible only for Discord protocol lifecycle:

- authenticate the bot;
- establish Gateway connection;
- heartbeat;
- reconnect;
- session resume;
- receive approved event types;
- normalize connection/rate-limit failures;
- expose connection health.

Gateway code must not own SG semantics, identity authority, roles, memory or capability selection.

## 8.1.3 Discord REST/Bot API client

Create a bounded Discord REST client for protocol operations required by SG delivery.

Initial operations:

- send message;
- reply to message;
- send supported attachments when authorized;
- retrieve only protocol metadata required for an approved operation.

The client must support bounded timeout, retry and Discord rate-limit handling. It must use the existing Credential and External Connections layers.

## 8.1.4 Production Discord event normalization

Live Discord events must be converted through the existing `createDiscordTransportAdapter()` contract or a compatible thin production wrapper.

Canonical platform facts must include, where present:

- `platform = discord`;
- Discord user ID;
- guild/server ID;
- channel ID;
- thread ID;
- message ID;
- reply/reference metadata;
- attachments;
- locale hints;
- descriptive profile metadata.

Discord-specific fields are facts only. They cannot assign canonical SG roles, grants or ownership.

## 8.1.5 Production Discord Identity Resolver

Add `productionDiscordIdentityResolver` using the same identity model as the production Telegram resolver.

Resolution order:

```text
verified Discord platform account
→ existing identity link
→ canonical global_user_id
→ SG roles/grants/profile
```

Identity must be safely resolved from durable platform-account links. It must not be semantically guessed on every response.

### Monarch binding

A configured, trusted Discord platform account may be anchored to the already existing canonical Monarch Global ID through deployment configuration and durable identity linking.

The canonical Monarch authority remains the Global ID, not the Discord ID.

The following must never prove Monarch identity:

- username;
- global/display name;
- server nickname;
- avatar;
- Discord server role;
- message text;
- secret words or commands;
- AI output.

### Ordinary cross-platform linking

Ordinary users must not be automatically merged across Telegram and Discord because names or profile fields match.

Cross-platform identity merging requires an explicit proof-of-control/linking flow. Until proof succeeds, separate platform accounts remain separate canonical identities.

## 8.1.6 Discord scope mapping

Map Discord resources into existing SG scope/resource authority boundaries.

Initial mapping:

```text
userScope    = canonical global_user_id
projectScope = SG project scope
groupScope   = Discord guild/server ID when present
threadScope  = Discord thread ID when present
```

Channel ID remains available as a platform/resource fact and may be represented through existing Resource Ownership & Authority / Conversation Context metadata. A new canonical scope dimension must not be introduced unless implementation evidence proves the existing model is insufficient and a separate architecture decision is approved.

DM, guild channel, thread and forum-style conversation contexts must remain isolated correctly.

## 8.1.7 Addressing and participation policy

In Discord servers SG should remain a bounded participant, not answer every message by default.

Initial response triggers are transport metadata, not keyword hacks:

- direct message to SG;
- explicit bot mention;
- reply/reference to SG;
- approved Discord interaction/application command;
- explicitly enabled autonomous-participation policy.

Natural-language content remains unchanged for Semantic Kernel interpretation.

## 8.1.8 Memory 2.0 integration

No Discord-specific memory subsystem is allowed.

Personal memory follows the verified canonical `global_user_id` across linked transports.

Therefore, after verified linking:

```text
Telegram account ─┐
                  ├→ same global_user_id → same authorized personal Memory 2.0
Discord account ──┘
```

Shared group/server memory remains scoped to the authorized Discord guild/resource and must never become personal memory automatically.

Private personal memory must not leak into Discord guild context merely because the same user is present there. Existing Memory 2.0 privacy and intent-aware recall rules remain authoritative.

## 8.1.9 Discord delivery transport

Add `DiscordDeliveryTransport` to the existing Delivery Transport Registry.

```text
SG result
   ↓
Delivery Router
   ├→ TelegramDeliveryTransport
   └→ DiscordDeliveryTransport
```

The Delivery Router owns target authorization and delivery policy. Discord transport executes only the final approved Discord protocol operation.

## 8.1.10 Durable event deduplication

Production Discord events must be idempotent and durably deduplicated.

A repeated Discord event must not cause:

- duplicate SG responses;
- duplicate memory capture;
- duplicate capability execution;
- duplicate AI calls;
- duplicate notifications.

Use stable Discord event/message identifiers plus transport namespace and PostgreSQL persistence compatible with the production Telegram deduplication principle.

## 8.1.11 Attachments

Discord attachments must enter the existing SG file-intake/document processing path after transport normalization and authorization.

The transport may download or reference an attachment only through approved connection/resource rules. It must not create a parallel Discord-specific document intelligence subsystem.

## 8.1.12 Discord permissions and resource authority

Discord server permissions and Discord roles are platform facts only.

Examples:

```text
Discord Administrator ≠ SG monarch
Discord server owner ≠ SG owner
Discord role ≠ SG role/grant
```

SG roles/grants continue to come from the canonical Access layer.

Discord permissions are used only to determine whether the bot technically may perform an approved platform action. Resource Ownership & Authority determines whether SG is authorized to act on the specific guild/channel/thread/resource for the requesting actor.

Least privilege is mandatory. The bot must not receive broad administrator permissions unless a concrete approved capability requires them.

## 8.1.13 Observability and diagnostics

Add secret-safe Discord facts to existing observability:

- transport/platform;
- event type;
- canonical global user ID after resolution;
- guild/channel/thread identifiers where policy permits;
- identity-resolution outcome;
- runtime outcome;
- delivery outcome;
- latency;
- retry/rate-limit state;
- normalized failures.

Diagnostics should expose bounded health such as:

```text
Discord configuration: valid/invalid
Gateway: connected/disconnected/degraded
Bot authentication: healthy/failed
Identity resolver: healthy/failed
Event store: healthy/failed
Delivery transport: healthy/failed
Runtime path: reachable/unreachable
```

Raw bot tokens and sensitive payloads must not appear.

## 8.1.14 Required automated tests

### Transport contract

- live-event wrapper preserves the existing canonical Discord adapter contract;
- Discord-specific metadata cannot inject SG roles, grants or final scope.

### Identity

- existing Discord identity link resolves to the same canonical Global ID;
- verified Monarch Discord account resolves to the configured canonical Monarch Global ID;
- username/nickname/avatar/server role cannot create Monarch authority;
- unlinked Telegram and Discord accounts are not merged by descriptive similarity;
- explicit successful cross-platform linking yields one Global ID.

### Scope and privacy

- DM isolation;
- guild isolation;
- channel/thread conversation isolation;
- Server A shared memory cannot appear in Server B;
- private personal memory is not exposed to other guild members.

### Memory

- verified linked user can write/confirm memory through one transport and recall it through another when intent and privacy policy permit;
- Discord does not create a second personal memory namespace.

### Delivery

- authorized Discord reply succeeds;
- unauthorized target fails closed;
- retries/rate limits do not duplicate delivery;
- Telegram delivery remains unaffected.

### Idempotency

- repeated Discord event is processed once;
- repeated event cannot duplicate AI, memory or protected actions.

### Failure handling

- Gateway disconnect/reconnect;
- session resume;
- REST timeout;
- rate limit;
- missing credentials;
- invalid Discord event;
- unavailable Discord connection.

## 8.1.15 Regression requirements

Block 8.1 must preserve the current known-good Telegram identity baseline LB-002.

No regression is allowed in:

- Telegram production integration;
- canonical Global ID resolution;
- Monarch role resolution;
- `self_identity` / `user_identity` semantic behavior;
- Identity Response Contract;
- Memory 2.0 M1–M9;
- Self Knowledge;
- BoundedResponseContext;
- AI Router-only model access;
- Delivery Router authorization;
- Action Gate and Resource Authority.

## 8.1.16 Live acceptance evidence

Automated CI is necessary but does not prove production Discord operation.

Completion requires live evidence from an actual Discord environment demonstrating at minimum:

1. bot connects successfully;
2. DM request reaches SG and receives a response;
3. guild mention/reply reaches SG and receives one response;
4. duplicate event does not duplicate response;
5. verified Monarch Discord account resolves to the same canonical Monarch Global ID used by Telegram;
6. an ordinary Discord user does not receive Monarch authority;
7. cross-platform Memory 2.0 works only after verified identity linking and only when recall is relevant/authorized;
8. Telegram LB-002 remains valid after deployment.

Live evidence should be recorded under `evidence/` without exposing secrets.

## Definition of Done

Block 8.1 is complete only when evidence proves all of the following:

- production Discord Gateway integration exists;
- production Discord REST/Bot API client exists;
- Discord events enter the existing TransportAdapter/SG runtime path;
- durable Discord event deduplication exists;
- production Discord identity resolution uses canonical Global ID links;
- Monarch Discord account is safely anchored to the existing Monarch Global ID;
- ordinary cross-platform linking requires proof of control;
- Discord scope/resource boundaries are enforced;
- Memory 2.0 is shared by verified Global ID rather than duplicated by transport;
- Discord Delivery Transport is registered behind the existing Delivery Router;
- permissions follow least privilege;
- observability and diagnostics are secret-safe;
- unit/integration/regression tests pass;
- `npm run check` passes;
- GitHub Actions CI succeeds;
- live Discord acceptance evidence exists;
- existing Telegram LB-002 remains non-regressed.

## Architectural result

After Block 8.1:

```text
Telegram ───────┐
Discord ────────┼→ thin transports
Web/API ────────┘
                    ↓
             Identity / Scope
                    ↓
              global_user_id
                    ↓
        one SG Core / Memory 2.0
                    ↓
              Delivery Router
               ↓           ↓
           Telegram      Discord
```

Discord becomes another controlled interface to the same Советник GARYA, not another assistant.