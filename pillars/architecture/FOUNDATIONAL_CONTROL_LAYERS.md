# SG 2.1 — FOUNDATIONAL CONTROL LAYERS

## Purpose

This document defines the architecture boundaries for roadmap Blocks 16.7–16.16. They complete foundational control and extensibility concerns before deployment validation expands further.

## Dependency order

```text
Configuration & Policy [completed]
→ Secrets & Credentials [completed]
→ External Connections Registry [completed]
→ Resource Ownership & Authority [completed]
→ Session & Conversation Context [completed]
→ User Settings & Preferences [completed]
→ Notification & Delivery Router [completed]
→ Internal Event Bus [completed]
→ Schema & Contract Versioning
→ Feature Flags & Controlled Rollout
```

The order is architectural dependency guidance. Protected execution composes the established controls as Identity → Scope → Access → Resource Authority (when a concrete resource is targeted) → Action Gate → Capability. Conversation context supplies dialogue continuity to semantic processing but never creates identity, access or authority.

## Block 16.7 — Configuration & Policy
Owns typed configuration, defaults, limits, policy precedence and effective-policy resolution. Environment variables are inputs, not the architecture itself. Policy cannot grant identity or bypass Action Gate.

## Block 16.8 — Secrets & Credentials
Owns stable credential handles, private secret references, credential lifecycle, user/project/connection/resource isolation, permission-bound access, redaction, audit and bounded provider access. Deployment environment variables are secret-store inputs only; raw values never become ordinary configuration, memory, prompts, diagnostics or telemetry. OpenAI and Telegram production paths consume credentials through this boundary.

## Block 16.9 — External Connections Registry
Owns the authoritative inventory and lifecycle state of external service/account connections available to SG.

Canonical connection record includes:

```text
connection_id
provider / service_type
owner_global_user_id + project_scope
external_account_id + safe account metadata
credential_id                  # handle from Block 16.8 only
approved scopes / permissions
provided capabilities
status / health
last verification timestamps
provenance / safe metadata
```

The registry exposes discovery by provider/capability plus a fail-closed `requireUsable` boundary. `connected` is the only state accepted for execution; `degraded`, `unavailable` and `revoked` are visible states and cannot silently execute through registry-aware provider paths.

The durable production store is PostgreSQL-backed through migration `169_external_connections.sql`. Deployment composition bootstraps known OpenAI/Telegram account connections from Block 16.8 credential handles, never from raw credential values. OpenAI Responses and Telegram Bot API paths verify connection usability before credential resolution/network execution.

A connection is not an identity. A connection does not prove ownership of every external resource. Multiple accounts of the same provider remain separate records. Block 16.10 consumes connection/account facts but remains authoritative for resource-level ownership and delegated authority.

## Block 16.10 — Resource Ownership & Authority
Owns verified relationships between actors/projects and independently addressable real or digital resources.

Canonical separation:

```text
Identity           → WHO is acting
Scope              → WHERE the request is bounded
Access / Grants    → WHAT KIND OF ACTION is permitted
Resource Authority → OVER WHICH RESOURCE the actor may act
Action Gate        → MAY THIS CONCRETE ACTION PROCEED NOW
```

Canonical resource records contain stable `resource_id`, resource type, provider, project scope, optional `connection_id`, external resource identifier, optional parent resource, verification state, provenance and safe metadata. PostgreSQL persistence is provided by `170_resource_authority.sql`.

Authority records are separate from resources and contain actor `global_user_id`, relation, project scope, verification source/state, delegation provenance, optional descendant inheritance, expiry and revocation state. Supported relations are `owns`, `administers`, `manages`, `can_read`, `can_publish` and `can_modify`.

Relation implication is explicit: ownership can satisfy subordinate relations; administration and management can satisfy bounded operational relations; read/publish/modify do not imply ownership. Delegation cannot exceed the delegator's effective relation. Revoked, expired, rejected or unverified authority does not authorize execution.

Hierarchy is fail-closed. Parent authority is never inherited merely because a resource is nested beneath another resource; inheritance requires `applies_to_descendants=true`. This prevents platform membership or server/workspace administration from silently becoming unrestricted authority over all descendants.

Runtime decisions may declare a `resourceRequirement { resourceId, relation }`. The runtime resolves authority against the current `global_user_id` and `project_scope`, records bounded evidence, and passes it into the Action Request. Action Gate verifies that the evidence matches actor, project, resource and required relation. Missing, mismatched or forged evidence causes denial before capability execution.

Resource Authority does not replace Identity, generic grants, Scope, External Connections or Action Gate. A connected account is useful evidence about availability, but is never by itself ownership proof. Adding SG to a Telegram group, Discord server, repository or channel does not establish owner/admin authority.

## Block 16.11 — Session & Conversation Context
Owns active dialogue continuity, sessions, conversation/topic identity, reply relationships and bounded recent context. It is separate from confirmed long-term memory.

Canonical conversation separation:

```text
Long-term Memory      → confirmed durable facts/preferences/history
Conversation Context  → bounded recent dialogue continuity
Transport Facts       → message/reply/session/thread identifiers only
```

Block 16.11 extends the canonical Block 12 `conversations` and `messages` persistence with migration `171_session_conversation_context.sql`. It adds durable sessions, topics, lifecycle state, reply linkage, transport/external message identity and continuation policy without creating a second competing message archive.

Automatic continuation is conservative. A conversation continues automatically only inside the same identity/project/group/thread boundary and the same transport/session boundary. A new transport session therefore does not silently merge with another conversation for the same user.

Reply chains may explicitly identify the correct scoped conversation. Topic shifts preserve the conversation identity while creating a new topic node whose recent-turn context is isolated from the previous topic. Closing a conversation removes it from automatic continuation.

Cross-transport continuation is explicit and fail-closed. The conversation must first be approved for cross-transport continuation; the same `global_user_id` and project remain mandatory. Private conversations may then create a new transport session attached to the approved conversation. Group/thread conversations cannot be silently converted into cross-transport private continuations.

The production runtime resolves Conversation Context before semantic interpretation and Language Context uses canonical `conversation_id` as its continuity key when available. The Semantic Kernel receives bounded recent turns; ordinary capability payloads receive only conversation identifiers/transition metadata, not duplicated recent-turn message content.

Conversation state never promotes dialogue into confirmed memory automatically and cannot broaden Identity, Scope, Access, Resource Authority or Action Gate permissions. Transition observability records IDs/state/counts rather than full message bodies.

## Block 16.12 — User Settings & Preferences
Owns one canonical typed preference boundary keyed by `global_user_id`. Effective settings combine safe defaults, global user preferences, project overrides and non-authoritative transport hints with field-level provenance and explicit/inferred state.

Language/locale and timezone now converge through adapters on this boundary instead of creating new competing stores. Durable state lives in PostgreSQL `user_settings` through migration `172_user_settings_preferences.sql`, which imports existing Block 16.5/16.6 values without deleting the legacy source state.

The runtime resolves settings before semantic interpretation. Response presentation, units, formatting and accessibility may be supplied as bounded execution context; delivery/autonomy/provenance remain outside ordinary capability payloads. Settings read/write use the normal capability/grant path.

User preferences cannot weaken mandatory safety, identity, scope, resource authority, permission or Action Gate policy. Inferred values cannot overwrite explicit values, and transport locale remains a hint rather than an identity-linked preference authority. Block 16.13 extends notification preferences with typed quiet-hours settings while preserving the same explicit/inferred and project-scoped rules.

## Block 16.13 — Notification & Delivery Router
Owns target selection and delivery lifecycle for already-authorized results. Delivery is a separate phase after semantic decision/action authorization; it never authorizes the action that produced a result.

Canonical delivery separation:

```text
Execution authorization → Action Gate / Resource Authority
Result                   → already-authorized SG output
Delivery routing         → recipient + approved target + transport selection
Transport adapter        → protocol-specific send only
```

`DeliveryRequest` carries a stable delivery/idempotency identity, delivery kind (`current-response` or `notification`), actor and recipient `global_user_id`, project scope, message/result payload, locale, trace context, and optional target resource/connection references. `DeliveryResult` reports delivered/suppressed/deferred/failed state, selected transport/target, attempt count and bounded failure code.

Current responses are origin-bound by default: Telegram replies return to the same inbound chat/thread/message without inventing new authority. Moving a result to another explicit resource is a different operation and requires verified `can_publish` Resource Authority. Cross-user delivery fails closed unless explicit prior authorization evidence is supplied. Connection-backed targets must remain usable through Block 16.9.

Notification preferences from Block 16.12 are consumed but cannot grant authority. `notifications.enabled=false` suppresses asynchronous notifications; typed quiet hours defer them using the configured/user timezone. Preferred transport is considered only if an approved target for that transport exists. Fallback targets are used only when explicitly configured.

Retries and timeouts are bounded. Delivery idempotency and status are durable in PostgreSQL `delivery_records` through migration `173_delivery_router.sql`, preventing repeated delivery after service recreation for the same idempotency key. Attempt/status observability records delivery IDs, transport and bounded failure codes rather than message bodies.

Telegram production delivery now uses the common router and a Telegram protocol adapter instead of calling `sendMessage` as independent delivery policy. Discord, Email, Web and Voice can register equivalent adapters without changing core routing logic.

Delivery failure is never converted into successful delivery. The router cannot broaden Identity, Scope, Access, Resource Authority, Connections or Action Gate policy.

## Block 16.14 — Internal Event Bus
Owns typed internal event delivery between SG subsystems. Events report facts and lifecycle transitions; they are not commands and cannot bypass Decision Engine or Action Gate.

Canonical event separation:

```text
Approved state/lifecycle change → producer emits typed fact
InternalEventEnvelope           → contract + trace + bounded scope + minimized payload
Event Bus                       → subscription matching + sync/durable delivery
Consumer                        → projection/observer or normal gated workflow
Protected effect                → still requires Action Gate/Capability path
```

The canonical envelope contains stable `event_id`, `event_type`, contract `version`, occurrence timestamp, trace context, actor, bounded user/project/resource scope, privacy classification, optional explicit `orderingKey`, provenance and minimized payload. Event names are registered lifecycle contracts for identity, connection, resource, conversation, memory, task, schedule, capability, delivery and failure domains; arbitrary command-like event names are rejected.

Subscribers are isolated by event type, privacy class and optional project/user/resource scope. Scope matching is fail-closed. Receiving an event never creates identity, grants, ownership, resource authority or execution authorization.

Two delivery modes exist. `sync` is for immediate in-process projections/observers and isolates subscriber failure from the producer. `durable` persists one consumer delivery per `(event_id, subscriber_id)` and uses bounded retry. Exhausted/non-retryable failures become visible dead letters and can be explicitly requeued. Stale `processing` claims are reclaimable after worker interruption so a restart does not permanently strand a durable event.

PostgreSQL persistence is provided by `174_internal_event_bus.sql` through `internal_events`, `internal_event_subscriptions` and `internal_event_deliveries`. The deployment composition selects PostgreSQL in persistent runtimes and in-memory storage otherwise. The bus exposes deterministic `drain` plus worker `start/stop` lifecycle for durable consumers.

Payload minimization is enforced before persistence. Secret/token/password/credential-style fields and unnecessary raw message/text/content/body fields are forbidden, and payload size is bounded. Event observability records event IDs/types/scope/privacy/subscriber/failure metadata with the originating trace context instead of raw message content or secrets.

Ordering is not globally promised. An `orderingKey` is only explicit metadata for consumers that require a domain-specific ordering contract; global publication order must not be inferred from the bus.

## Block 16.15 — Schema & Contract Versioning
Owns compatibility, migration and deprecation rules for durable/cross-module contracts. Database migration numbering alone is insufficient. Old payloads must never be silently reinterpreted.

## Block 16.16 — Feature Flags & Controlled Rollout
Owns controlled enablement, cohorts, rollout and kill switches. A feature flag can restrict availability but cannot create permissions, ownership or authority that do not already exist.

## Shared invariants

- `global_user_id` remains the root personal identity.
- No secret words, commands or phrase bindings establish identity, ownership or authority.
- Resource authority never replaces role/grant checks or Action Gate.
- Resource-targeted execution fails closed without matching verified authority evidence.
- Parent-resource authority does not inherit unless explicitly configured.
- Conversation context never creates or confirms identity, ownership, permissions or long-term memory.
- Separate transport sessions/conversations do not automatically merge.
- Group/thread scope remains authoritative for dialogue continuity.
- Cross-transport conversation continuation requires explicit approval.
- Connections never expose raw credentials to ordinary context.
- Connection possession does not establish user identity or resource ownership.
- Unavailable/revoked connections fail closed before provider credential/network use on integrated paths.
- User preferences cannot weaken non-negotiable policy.
- Delivery cannot target an unauthorized user/resource.
- Delivery failure cannot be reported as successful delivery.
- Events cannot execute protected effects outside normal capability/gate paths.
- Contract adapters cannot broaden trust, permissions or scope.
- Feature flags cannot grant access.
- All layers remain transport-independent and observable.
