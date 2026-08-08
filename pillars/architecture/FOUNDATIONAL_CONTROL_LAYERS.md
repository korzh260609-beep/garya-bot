# SG 2.1 — FOUNDATIONAL CONTROL LAYERS

## Purpose

This document defines the architecture boundaries for roadmap Blocks 16.7–16.16. They complete foundational control and extensibility concerns before deployment validation expands further.

## Dependency order

```text
Configuration & Policy [completed]
→ Secrets & Credentials [completed]
→ External Connections Registry [completed]
→ Resource Ownership & Authority
→ Session & Conversation Context
→ User Settings & Preferences
→ Notification & Delivery Router
→ Internal Event Bus
→ Schema & Contract Versioning
→ Feature Flags & Controlled Rollout
```

The order is architectural dependency guidance. Every protected action still follows the existing Identity → Scope → Decision → Action Gate → Capability boundaries.

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
Owns verified relationships between actors/projects and addressable resources.

Canonical separation:

```text
Identity  → WHO is acting
Scope     → WHERE the request is bounded
Access    → WHAT action class/capability is permitted
Authority → OVER WHICH RESOURCE the actor may act
```

Resource authority may represent ownership, administration, management, read, publish or modify authority with provenance and revocation. Platform membership alone is insufficient proof.

## Block 16.11 — Session & Conversation Context
Owns active dialogue continuity, sessions, conversation/topic identity, reply relationships and bounded recent context. It is separate from confirmed long-term memory.

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
- Connections never expose raw credentials to ordinary context.
- Connection possession does not establish user identity or resource ownership.
- Unavailable/revoked connections fail closed before provider credential/network use on integrated paths.
- User preferences cannot weaken non-negotiable policy.
- Delivery cannot target an unauthorized user/resource.
- Events cannot execute protected effects outside normal capability/gate paths.
- Contract adapters cannot broaden trust, permissions or scope.
- Feature flags cannot grant access.
- All layers remain transport-independent and observable.
