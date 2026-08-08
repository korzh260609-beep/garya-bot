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
→ User Settings & Preferences
→ Notification & Delivery Router
→ Internal Event Bus
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
Owns typed user preferences keyed by `global_user_id`, including language, locale, timezone, response presentation and notification preferences. Preferences cannot weaken mandatory safety/authorization policy.

## Block 16.13 — Notification & Delivery Router
Owns target selection and delivery lifecycle for already-authorized results. It consumes identity, resource authority, connections and user preferences; it does not decide semantics or authorization.

## Block 16.14 — Internal Event Bus
Owns typed internal event delivery between SG subsystems. Events report facts and lifecycle transitions; they are not commands and cannot bypass Decision Engine or Action Gate.

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
- Events cannot execute protected effects outside normal capability/gate paths.
- Contract adapters cannot broaden trust, permissions or scope.
- Feature flags cannot grant access.
- All layers remain transport-independent and observable.
