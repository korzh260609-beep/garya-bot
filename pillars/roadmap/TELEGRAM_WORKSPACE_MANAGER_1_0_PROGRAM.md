# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0 PROGRAM

## Status
**PLANNED / NOT IMPLEMENTED.**

TWM1 is the cross-cutting Telegram workspace management program that lets any authorized SG user configure SG for their own Telegram groups, supergroups and channels through native Telegram UI and natural language.

TWM1 does not renumber Blocks 0–19 and does not replace Block 14 Telegram Production Integration. It depends on the existing Telegram transport/runtime, Identity & Scope, Resource Authority, Action Gate, Configuration/Policy, PostgreSQL, AI Router, Memory 2.0 isolation and Observability.

## Goal
Deliver this real-user flow:

```text
user opens SG
→ connects/discovers Telegram workspace
→ SG verifies user authority
→ SG verifies its own bot permissions
→ user completes simple setup
→ configuration is persisted per workspace
→ runtime behavior changes
→ changes survive restart
→ unauthorized users cannot mutate settings
→ authority loss revokes control
→ history/rollback/diagnostics remain available
```

## Canonical implementation order

### TWM1.1 — Workspace Contract & Lifecycle
**Status: PLANNED.**

Implement:
- canonical `TelegramWorkspace` contract and SG-issued `workspace_id`;
- workspace types: group, supergroup, channel;
- lifecycle: DISCOVERED, CONNECTED, CONFIGURING, ACTIVE, DEGRADED, DISCONNECTED, REVOKED;
- strict workspace scope fields in request/action context;
- group→supergroup migration semantics;
- no ownership inference from name, username, first message or invitation order.

**Gate:** deterministic contract tests; invalid/cross-workspace identities fail closed.

### TWM1.2 — PostgreSQL Workspace Persistence
**Status: PLANNED.**

Implement durable tables/stores for:
- workspaces;
- workspace members/roles;
- bot permissions;
- configuration;
- configuration history/versioning.

Requirements:
- transactional writes;
- canonical workspace isolation;
- restart durability;
- migration compatibility;
- no secrets in workspace configuration/history.

**Gate:** persistence survives PostgreSQL restart with no cross-workspace leakage.

### TWM1.3 — Telegram Workspace Discovery & Registry
**Status: PLANNED.**

Implement:
- discovery from real Telegram updates;
- explicit registration/resolution of group/channel resources;
- metadata refresh;
- bot membership status;
- removal/reconnect handling;
- group→supergroup migration handling;
- user-facing list of managed/discovered workspaces.

**Gate:** one user can discover multiple independent real Telegram workspaces without duplicate canonical roots.

### TWM1.4 — Workspace Authority Verification
**Status: PLANNED.**

Implement `TelegramWorkspaceAuthorityResolver` using:
- verified Telegram Identity Link → canonical `global_user_id`;
- current Telegram resource evidence;
- existing Resource Authority registry/policy;
- bounded TWM workspace roles/grants;
- requested action.

Sensitive actions require fresh/policy-valid Telegram authority evidence.

**Gate:** member denied; administrator allowed only within verified workspace scope; authority loss revokes access; no SG-global escalation.

### TWM1.5 — Bot Permission Discovery & Capability Health
**Status: PLANNED.**

Implement detection/caching/refresh of actual SG bot permissions in each workspace.

Runtime/configuration must know whether SG can perform required Telegram actions such as post/edit/delete/restrict/pin/invite where applicable.

**Gate:** missing bot permission produces explicit degraded/denied result, never false success.

### TWM1.6 — Workspace Configuration Service
**Status: PLANNED.**

Implement the sole mutation surface:
- get/list config;
- propose change;
- schema/value validation;
- authority evaluation;
- confirmation/risk classification;
- atomic versioned apply;
- history;
- rollback;
- audit event emission.

Namespaces:
- general;
- responses;
- moderation;
- memory;
- ai;
- publication;
- automation;
- notifications;
- members.

**Gate:** no transport/UI/AI direct DB write path exists.

### TWM1.7 — Decision / Action Gate Integration
**Status: PLANNED.**

Route every state-changing TWM action through existing SG action classification and Action Gate.

Low-risk reversible settings may use approved immediate apply; destructive/high-impact actions require preview/confirmation.

**Gate:** protected actions cannot bypass Action Gate from callback, command, natural language, worker or AI output.

### TWM1.8 — Telegram Native UI & Setup Wizard
**Status: PLANNED.**

Implement inline-keyboard management in private chat and/or scoped workspace context:
- list/select workspaces;
- connect instructions;
- setup wizard;
- response settings;
- moderation;
- publication/channel settings;
- memory/AI/automation/notifications;
- members/roles;
- diagnostics/history/rollback.

UI must expose progressive complexity rather than a flat large settings list.

**Gate:** a non-technical user can complete first setup without code, JSON, `.env` or database access.

### TWM1.9 — Natural-Language Configuration
**Status: PLANNED.**

Support ordinary language such as:

```text
"SG, in Crypto answer only when mentioned"
"enable anti-spam in this group"
"who disabled links in Witch?"
```

Use Semantic Kernel and AI Router only where needed to create bounded structured proposals. AI output remains non-authoritative data.

Resolve current workspace from explicit chat scope; private-chat references must resolve deterministically and ask selection only when genuinely ambiguous.

**Gate:** no keyword hacks; proposal→authority→validation→confirmation→Action Gate→service apply path is enforced.

### TWM1.10 — Workspace Runtime Wiring
**Status: PLANNED.**

Wire persisted workspace settings into real Telegram behavior:
- response modes;
- configured moderation policies;
- channel publication policy;
- workspace memory enablement within Memory 2.0 rules;
- AI feature availability within existing routing/policy;
- automation/notification behavior where existing capabilities support it.

**Gate:** changing a setting changes real runtime behavior and survives service restart.

### TWM1.11 — Audit, Rollback, Diagnostics & Observability
**Status: PLANNED.**

Implement:
- who/what/when/before/after history;
- authorized rollback as a new audited mutation;
- connection/authority/bot-permission/config health;
- degraded capability explanations;
- last config success/failure;
- authorization denial and action counters;
- trace-id continuity and secret-safe observability.

**Gate:** SG can answer who changed a setting and restore an allowed prior configuration version.

### TWM1.12 — Production E2E & Live Acceptance
**Status: PLANNED.**

Prove with real Telegram group and channel flows:

```text
new SG user
→ add SG to workspace
→ workspace discovered
→ authority verified
→ bot permissions verified
→ setup completed
→ config saved
→ runtime behavior changes
→ restart preserves config
→ ordinary member denied mutation
→ admin allowed mutation
→ admin loses Telegram rights
→ further mutation denied
→ second workspace remains isolated
→ audit/history correct
```

Repeat equivalent channel acceptance for publication/configuration semantics.

**Gate:** complete real Telegram production acceptance with CI plus live evidence appropriate to the claim.

### TWM1.13 — Telegram Mini App
**Status: PLANNED AFTER TWM1.12.**

Add optional rich UI over the same TWM backend for complex management, statistics and large configuration sets.

The Mini App cannot create a second authorization, configuration or business-logic stack.

**Gate:** parity with backend authorization and config semantics; disabling Mini App does not disable chat/inline management.

## UX principles
- natural language is primary;
- Telegram-native inline UI is the first visual control plane;
- setup is wizard-based and progressive;
- technical identifiers are hidden unless diagnostic detail is requested;
- SG explains missing permissions in user language;
- dangerous changes show impact before execution;
- one user may manage many workspaces;
- one workspace may have multiple authorized managers with bounded roles.

## Security boundaries
TWM1 must never:
- treat Telegram username/name as identity or authority;
- treat any Telegram administrator as SG owner/Monarch;
- let AI write config directly;
- let a config key weaken mandatory SG security/Action Gate/owner security;
- leak settings, memory, members or audit between workspaces;
- store bot tokens/secrets in ordinary workspace config;
- claim success when Telegram denies the required action;
- persist stale authority indefinitely without re-verification policy.

## Dependencies
Uses existing:
- Block 14 Telegram Production Integration;
- Identity & Scope / canonical `global_user_id`;
- Block 16.10 Resource Ownership & Authority;
- Decision / Action Gate;
- Block 16.7 Configuration & Policy;
- PostgreSQL persistence;
- Memory 2.0;
- AI Router;
- Delivery Router;
- Observability / Internal Event Bus;
- Security & Operations controls.

## Definition of DONE
TWM1 is complete when TWM1.1–TWM1.12 are implemented, tested, CI-verified and live-accepted, and any authorized ordinary SG user can safely configure their own Telegram groups/channels without programming while unauthorized users cannot. TWM1.13 is an optional richer UI extension after the core Telegram-native system is complete.
