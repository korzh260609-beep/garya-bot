# SG 2.1 — MEMORY 2.0 CANONICAL ARCHITECTURE

## Status

Canonical architecture specification. Implementation status is determined only by code, tests and runtime evidence.

## Purpose

Complete SG memory as one transport-independent, durable, privacy-bounded and scope-safe subsystem without replacing the existing memory/context architecture.

Memory 2.0 extends the current SG 2.1 foundations. It must preserve `global_user_id`, project/group/thread scope isolation, Conversation Context separation, Action Gate, Resource Authority, provenance, trust, observability and PostgreSQL durability.

## Canonical memory domains

SG memory is separated into these domains:

```text
Session Memory        -> short-lived current interaction state
User Memory           -> durable facts/preferences about one global user
User × Group Memory   -> facts about one user that are valid in one group context
Group Shared Memory   -> facts belonging to the shared group context
Thread / Topic Memory -> facts and digest for one group thread/topic
Conversation Archive  -> durable dialogue history, not automatically confirmed truth
Topic Digest          -> compact derived summary with provenance
Project Memory        -> durable project-scoped knowledge
External Evidence     -> sourced evidence with provenance/trust
Runtime State         -> bounded operational state
System Self Knowledge -> SG-owned structured knowledge about SG itself
```

System Self Knowledge remains governed by `SELF_KNOWLEDGE.md` and is never ordinary user/group/project memory.

## Canonical scope model

Personal memory root:

```text
global_user_id + project_scope + optional group_scope + optional thread_scope
```

Shared group memory root:

```text
project_scope + group_scope + optional thread_scope
```

Shared group records MUST NOT require a user's identity as the ownership key. They MUST preserve creator/actor provenance separately.

A `thread_scope` requires a `group_scope`.

Scopes never broaden automatically. Data may move between scopes only through an explicit policy-controlled promotion/consolidation operation.

## Privacy classes

Every durable memory record must have one privacy class:

- `private` — readable only in the owning user's authorized personal context;
- `user-group` — user-specific memory bounded to one group;
- `group` — shared memory available according to group membership/authority policy;
- `project` — project-scoped shared knowledge;
- `system` — SG-owned system knowledge;
- `public` — explicitly approved public information.

Privacy filtering occurs before recall results reach semantic processing or answer composition.

## Record model

A canonical durable memory record must support at least:

- stable `memory_id`;
- memory domain/layer;
- key/topic/entity references;
- value/content;
- complete scope;
- privacy class;
- provenance (`source_type`, `source_id`, actor/creator, source timestamp where available);
- trust level;
- confidence where derived;
- confirmation state;
- lifecycle state;
- `created_at`;
- `updated_at`;
- `last_accessed_at` where useful;
- optional `expires_at`;
- optional `superseded_at` and successor relation;
- optional `archived_at`;
- tags/classification;
- version/revision metadata.

Raw credentials and secrets are forbidden memory payloads.

## Trust model

Existing trust levels remain valid and may be extended only by explicit architecture decision:

- `unverified`;
- `reported`;
- `confirmed`;
- `verified`.

Derived summaries/digests are not automatically verified merely because SG generated them.

## Lifecycle states

Memory lifecycle distinguishes at least:

- `active`;
- `temporary`;
- `expired`;
- `superseded`;
- `archived`;
- `deleted` where retention policy permits deletion.

Expired/superseded/deleted records are excluded from normal recall unless a history/audit request explicitly requires them.

## Capture rule

Raw dialogue never becomes confirmed durable memory automatically.

Automatic Memory Capture may propose or create bounded non-confirmed/derived records only according to policy. Promotion into confirmed user/project/group facts requires the applicable confirmation/trust rule.

The capture pipeline is:

```text
message/event
-> identity + scope resolution
-> privacy/sensitivity classification
-> memory-worthiness decision
-> target domain/layer selection
-> duplicate/conflict check
-> policy/confirmation check
-> write with provenance
-> audit event
```

Low-value conversational noise must not become durable memory.

## Shared group rule

Group Shared Memory represents the group's shared context, not the private memories of its members.

Examples of appropriate group memory include approved group rules, shared decisions, project dates and common operating facts.

Private user facts MUST NOT be copied into group memory merely because they were spoken by a user in a group. Promotion requires explicit classification and policy.

## Consolidation rule

Memory Consolidation must preserve history while producing one current usable representation when facts evolve.

The engine must support:

- exact and semantic duplicate detection;
- conflict detection;
- supersession/version chains;
- current-fact selection;
- archival of stale values;
- topic/session summarization;
- `topic-digest` production;
- provenance preservation;
- rollback/audit visibility.

Consolidation cannot silently convert uncertain data into confirmed truth.

## Recall rule

Recall is scope-first and permission-first.

Canonical order:

```text
request
-> identity/scope
-> authorized memory domains
-> privacy filter
-> candidate retrieval
-> relevance scoring
-> trust/confirmation weighting
-> freshness/lifecycle weighting
-> conflict handling
-> bounded ContextBundle
-> semantic processing
```

A useful default ranking combines semantic relevance, exact entity/key match, trust, confirmation, freshness, scope specificity and recency without allowing relevance to bypass authorization.

Recall must expose bounded diagnostics describing why records were selected/excluded without leaking unauthorized content.

## Cross-platform rule

`global_user_id` is the root of personal memory across transports.

Telegram/Discord/Web/API accounts are identity links, not separate people. Once platform identities are verified as one global user, authorized personal memory may follow that user across transports.

Group memory remains attached to the actual group/resource scope and does not become globally portable merely because the same person participates elsewhere.

## Conversation Context relationship

Conversation Context remains a separate subsystem for bounded recent dialogue continuity.

Conversation messages may be sources for capture/consolidation, but Conversation Context itself is not confirmed long-term memory.

No Memory 2.0 feature may weaken Block 16.11 conversation scope isolation.

## System Self Knowledge relationship

System Self Knowledge may describe the Memory 2.0 architecture and implementation state, but it remains a dedicated SG-owned store.

User/group memory cannot redefine SG identity, owner, architecture or authority.

## Permissions

Memory operations are permission-bound:

- read;
- create/propose;
- confirm;
- update/supersede;
- archive;
- delete where allowed;
- promote between scopes;
- inspect provenance/history.

The monarch/owner administrative view does not remove privacy/audit requirements; sensitive access must remain explicit and observable.

## Observability

Memory observability must record bounded metadata for:

- capture decision;
- write/update/supersession;
- conflict;
- consolidation;
- recall query;
- selected/excluded counts;
- scope/privacy denial;
- expiry/archive;
- administrative operation;
- migration/rebuild failure.

Ordinary telemetry must not contain raw private memory content or secrets.

## Required implementation program

Memory 2.0 is implemented through M1–M9:

1. M1 — Memory Scope Model;
2. M2 — Shared Group Memory;
3. M3 — Automatic Memory Capture;
4. M4 — Memory Consolidation Engine;
5. M5 — Intelligent Recall Engine;
6. M6 — Cross-Platform Global Memory;
7. M7 — Memory Permissions & Privacy;
8. M8 — Memory Lifecycle;
9. M9 — Memory Control, Diagnostics & Tests.

Canonical implementation order is defined by `../workflow/MEMORY_2_0_WORKFLOW.md`; roadmap scope and acceptance gates are defined by `../roadmap/MEMORY_2_0_ROADMAP.md`.

## Global invariants

- No cross-user, cross-group, cross-thread or cross-project leakage.
- Shared group memory is a first-class scope, not a fake user record.
- Private memory never becomes shared memory implicitly.
- Raw dialogue never becomes confirmed truth automatically.
- Every durable fact preserves provenance.
- Conflicts remain visible until resolved/superseded.
- Recall cannot broaden scope or permissions.
- Cross-platform personal continuity requires verified global identity.
- Secrets never enter ordinary memory.
- Memory cannot grant identity, roles, permissions, ownership or resource authority.
- Memory cannot bypass Decision Engine, Action Gate or Capability execution boundaries.
