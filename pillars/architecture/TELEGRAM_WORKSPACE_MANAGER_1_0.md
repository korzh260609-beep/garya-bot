# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0

## Status
**PLANNED / NOT IMPLEMENTED.**

Telegram Workspace Manager 1.0 (TWM1) is a cross-cutting SG module that lets any authorized SG user connect, configure and operate SG inside Telegram groups, supergroups and channels without programming.

TWM1 is not a new Telegram transport, not a second identity system, not a second access-control system and not an AI-owned configuration surface. It reuses the existing SG runtime boundaries.

## Goal
A user must be able to:

```text
open SG in Telegram
→ discover or connect a group/channel
→ prove current authority over that Telegram resource
→ see SG's actual bot permissions
→ configure behavior through native Telegram UI or natural language
→ preview/confirm protected changes
→ persist configuration per workspace
→ have runtime behavior change accordingly
→ audit and rollback configuration changes
```

No user should need to edit code, `.env`, JSON, webhook configuration or database rows.

## Canonical relationship

```text
Telegram Transport
  → Identity & Scope
  → Telegram Workspace Resolver
  → Resource Authority
  → Workspace Configuration Service
  → Decision / Action Gate
  → PostgreSQL
  → Telegram Runtime
```

Natural-language configuration adds only:

```text
user text
→ Semantic/Intent resolution
→ AI Router when needed
→ structured Configuration Proposal
```

AI/model output is proposal data only. It never writes configuration directly and never grants authority.

## Telegram Workspace
A `TelegramWorkspace` is one managed Telegram resource:

```text
group
supergroup
channel
```

Canonical fields include:
- workspace_id — SG-issued stable workspace identifier;
- platform = `telegram`;
- telegram_chat_id — platform locator, not the SG canonical root;
- workspace_type;
- title / username metadata;
- lifecycle state;
- bot membership state;
- bot permission snapshot;
- created/updated timestamps.

Telegram group→supergroup migration must preserve the canonical SG workspace identity and configuration through an explicit migration relation rather than creating silent duplicate workspaces.

## Identity and authority
Canonical human identity remains `global_user_id`.

```text
telegram platform_user_id
→ verified Identity Link
→ global_user_id
→ workspace-specific authority evidence
→ requested action
```

TWM1 must not infer ownership from names, usernames, first message, first bot invitation or model output.

Telegram creator/administrator status is resource-authority evidence for a concrete workspace. It is not an SG-global role.

Effective permission is bounded by all applicable controls:

```text
effectivePermission =
Telegram resource permission
∩ SG workspace grant/policy
∩ SG bot capability/permission
∩ Action Gate policy
```

A user who loses Telegram authority must lose corresponding TWM authority after re-verification. Sensitive mutations require fresh or policy-valid authority evidence.

## Workspace roles
TWM1 may expose bounded workspace roles such as:

```text
OWNER
ADMIN
EDITOR
MODERATOR
VIEWER
```

These roles are scoped only to one workspace. They must not grant SG-wide owner/Monarch authority.

Telegram platform status and SG workspace role remain separate facts. Internal grants may be stricter than Telegram permissions but cannot broaden them.

## Workspace lifecycle
Canonical lifecycle:

```text
DISCOVERED
CONNECTED
CONFIGURING
ACTIVE
DEGRADED
DISCONNECTED
REVOKED
```

`DEGRADED` means SG remains connected but lacks one or more permissions/capabilities required by configured behavior.

## Configuration model
Configuration is workspace-scoped and namespace-based:

```text
workspace.general
workspace.responses
workspace.moderation
workspace.memory
workspace.ai
workspace.publication
workspace.automation
workspace.notifications
workspace.members
```

Representative keys:

```text
workspace.responses.mode = mention_only
workspace.responses.reply_enabled = true
workspace.moderation.spam.enabled = true
workspace.memory.enabled = true
workspace.ai.enabled = true
```

Configuration is versioned. Every mutation records actor, scope, old value, new value, reason/source, trace id and timestamp.

## Persistence
Planned PostgreSQL entities:
- `telegram_workspaces`;
- `telegram_workspace_members`;
- `telegram_workspace_bot_permissions`;
- `telegram_workspace_configs`;
- `telegram_workspace_config_history`.

All rows are scoped by canonical workspace id. Cross-workspace reads/writes fail closed unless explicitly authorized.

## Workspace Configuration Service
`WorkspaceConfigurationService` is the only TWM service permitted to mutate workspace configuration.

Required responsibilities:
- list/get workspace configuration;
- produce configuration proposals;
- validate schemas and values;
- authorize the requested mutation;
- determine confirmation requirements;
- apply atomic versioned changes;
- expose history;
- rollback to an authorized prior version;
- emit bounded audit/observability events.

Telegram adapters, UI callbacks, AI Router and language responders must not write configuration storage directly.

## Telegram Workspace Registry
`TelegramWorkspaceRegistry` owns resource discovery and metadata state:
- register discovered groups/channels;
- resolve Telegram chat ids to canonical workspace ids;
- refresh title/type/username metadata;
- detect bot removal or reconnect;
- detect group→supergroup migration;
- expose actual bot membership and permissions.

## Authority Resolver
`TelegramWorkspaceAuthorityResolver` evaluates:

```text
global_user_id
+ verified telegram identity link
+ workspace_id
+ requested_action
+ current Telegram resource evidence
+ SG workspace grants
```

Output must be explicit and auditable: allowed/denied, role/grant, Telegram evidence, reason and verification time.

## Bot permission awareness
TWM1 must know what SG itself can actually do in each workspace, including relevant Telegram permissions such as posting, editing, deleting, restricting, pinning and inviting where applicable.

A configuration may be stored only when its semantics are valid. If a requested behavior requires a missing Telegram bot permission, SG must explain the missing permission and remain fail-closed rather than claiming success.

## Native UX
TWM1 has three UI surfaces over the same backend:

1. **Telegram inline UI** — mandatory first implementation.
2. **Natural-language configuration** — primary conversational control.
3. **Telegram Mini App** — later rich management surface.

The Mini App must not contain a parallel authorization or business-logic stack.

### Setup wizard
First-time setup should be progressive and simple:

```text
select workspace purpose
→ choose SG role/behavior
→ choose response mode
→ choose basic moderation/publication policy
→ verify bot permissions
→ review
→ activate
```

Templates may provide safe defaults, but template selection never bypasses validation or authorization.

## Natural-language configuration
Example:

```text
"SG, in Crypto reply only when mentioned"
```

must resolve to a structured proposal such as:

```json
{
  "action": "workspace.config.update",
  "workspace_id": "wsp_...",
  "changes": {
    "workspace.responses.mode": "mention_only"
  }
}
```

Then:

```text
resolve workspace
→ verify authority
→ validate proposal
→ show impact/confirmation when required
→ Action Gate
→ apply through WorkspaceConfigurationService
```

No keyword hack may substitute for semantic workspace resolution or authority checks.

## Confirmation and risk
Low-risk reversible toggles may use policy-approved immediate apply.

Protected or high-impact actions require explicit preview/confirmation and Action Gate handling, including actions capable of mass moderation, broad publication, role changes, destructive changes or other material external effects.

## Workspace memory boundary
Workspace memory is a separate scope from personal memory and Project Memory.

```text
user memory ≠ workspace memory ≠ project memory
```

Private user facts must not become group/channel memory merely because the same user administers that workspace. Workspace configuration cannot weaken Memory 2.0 privacy/scope rules.

## Audit and rollback
Every accepted mutation must provide an auditable history and authorized rollback path.

Users with sufficient authority should be able to ask who changed a setting, when it changed and restore an earlier version. Rollback itself is a new audited state-changing action.

## Diagnostics and observability
TWM1 should expose bounded secret-safe health such as:
- workspace connection state;
- authority verification state;
- bot permission health;
- configuration version;
- degraded configured capabilities;
- last successful/failed configuration mutation;
- workspace action counts;
- authorization denials.

Observability must preserve trace ids and must not expose secrets or private cross-workspace data.

## Isolation
Hard rule:

```text
Workspace A ≠ Workspace B
```

Settings, members, memory, automation, publication state and authority evidence do not cross workspace boundaries by default, even when the same human administers both.

## Reuse of existing SG layers
TWM1 MUST reuse:
- Telegram Production Integration / thin transport adapter;
- canonical `global_user_id` and Identity Links;
- Identity & Scope;
- Resource Ownership & Authority;
- Decision / Action Gate;
- Configuration & Policy boundaries;
- PostgreSQL persistence;
- Memory 2.0 scope/privacy rules;
- AI Router;
- Observability and Internal Event Bus;
- Delivery Router where outbound delivery is required.

## Non-negotiable boundaries
- no second Telegram transport;
- no second identity root;
- no username/name/phrase ownership hacks;
- no AI→database configuration path;
- no model-created authority;
- no automatic promotion of Telegram admin to SG-global admin/owner;
- no cross-workspace configuration or memory leakage;
- no success claim when Telegram denies required bot permissions;
- no hidden destructive actions without required confirmation;
- no configuration setting may weaken mandatory security, owner security or Action Gate policy;
- bot tokens/secrets remain outside ordinary workspace configuration and model context.

## Definition of architectural success
TWM1 architecture is satisfied when one shared backend can safely support many users and many independent Telegram groups/channels, where each authorized user can configure only resources they are currently permitted to control, all changes are versioned/auditable, and SG runtime behavior consumes the resulting workspace configuration without bypassing existing SG control layers.
