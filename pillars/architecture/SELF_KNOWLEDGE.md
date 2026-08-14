# SG 2.1 — SELF KNOWLEDGE / SYSTEM SELF-AWARENESS

## Purpose

Define how SG maintains a current, verifiable and durable model of itself without treating raw documentation, model output or user text as system truth.

Self Knowledge is a platform subsystem. It is not a personality layer and it is not ordinary user/project memory.

## Canonical separation

```text
User Memory           = facts about one user
Project Memory        = facts about user/project work
System Self Knowledge = facts about SG itself
Runtime Evidence      = live confirmation of current operational state
Response Context      = bounded, request-specific composition of authorized facts for final answering
```

These layers must remain separate. Response Context is assembled per request and is not a new durable memory store.

## Canonical identity baseline

SG must always be able to resolve at least:

- canonical name: `Советник GARYA`;
- short name: `СГ`;
- entity type: one global transport-independent SG project system;
- owner authority: the verified Monarch/owner defined by the Identity + Owner Security boundary;
- reasoning rule: connected AI models provide reasoning/specialized execution, while SG owns context, policy, authorization, capability orchestration and evidence;
- current architecture revision and knowledge revision.

A model response cannot redefine these facts.

## Authoritative inputs

Self Knowledge may be built only from approved system sources:

1. `pillars/DECISIONS.md`;
2. `pillars/SG_ENTITY.md`;
3. active `pillars/architecture/*`;
4. active `pillars/roadmap/*`;
5. approved module specifications;
6. actual code/configuration composition;
7. database migrations/schema state where relevant;
8. tests, diagnostics and runtime evidence;
9. registered integrations/connections and their verified state.

Authority order remains:

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

Documentation describes intent and boundaries. Claims about current implementation must be verified against code/evidence.

## Self Knowledge Store

Create a dedicated system store conceptually named `system_self_knowledge`.

It must not reuse ordinary user memory records.

Minimum categories:

- `identity`
- `purpose`
- `owner`
- `architecture`
- `capabilities`
- `modules`
- `integrations`
- `roles`
- `security`
- `memory`
- `task_engine`
- `sources`
- `ai_models`
- `deployment`
- `development_status`
- `limitations`
- `planned_features`

Each record must preserve provenance and version metadata.

## Capability status model

Every capability or subsystem fact must carry one canonical status:

- `implemented`
- `partial`
- `planned`
- `disabled`
- `broken`
- `unknown`

`planned` must never be presented as working.

`disabled`, `broken` and `unknown` must never be presented as currently available.

## SelfKnowledgeBuilder

The Self Knowledge Builder must:

1. read approved canonical sources;
2. collect implementation/runtime evidence where available;
3. normalize facts into structured Self Knowledge records;
4. detect documentation/implementation conflicts;
5. assign status and provenance;
6. persist a versioned snapshot;
7. avoid duplicate snapshots when no material state changed.

The builder must not dump the entire repository into prompts or memory.

## Consistency checking

A `SelfKnowledgeConsistencyChecker` must detect at least:

- roadmap says completed but implementation is missing;
- code exists while canonical docs still say planned;
- integration is declared but required connection/configuration is absent;
- migration/schema evidence conflicts with documentation;
- a Self Knowledge snapshot points to an outdated repository revision;
- two active canonical sources disagree.

Conflicting facts must be marked `uncertain`/`unknown` until resolved and must not be stated as confirmed current capability.

## Versioning

Each material Self Knowledge snapshot must include:

- `version`
- `created_at`
- `source_revision`
- `git_commit_sha`
- `environment`
- `validation_status`

The exact storage schema may evolve, but provenance and revision binding are mandatory.

## Bounded Response Context

Final AI answer composition must consume one SG-owned request context rather than receiving only raw user text.

Conceptual contract:

```text
BoundedResponseContext {
  identity,
  scope,
  roles,
  confirmedUserMemory,
  confirmedProjectMemory,
  conversationContext,
  selfKnowledge,
  userSettings,
  languageContext,
  temporalContext,
  runtimeEvidence,
  provenance,
  truncationEvidence
}
```

Fields may be absent when irrelevant. Presence must never imply permission or authority.

### Assembly order

```text
Transport facts
→ verified Identity
→ verified Scope
→ authorized Context/Memory retrieval
→ bounded Conversation Context
→ relevant Self Knowledge retrieval
→ Settings / Language / Temporal context
→ optional Runtime/Diagnostics evidence
→ deterministic filtering and budget enforcement
→ BoundedResponseContext
→ AI Router
→ Response Composer
```

The Response Composer is an execution component. It receives resolved facts; it does not resolve identity, authorization, ownership or trust itself.

### Inclusion policy

The assembler must include only request-relevant and authorized facts. It must:

- retrieve confirmed user memory only for the resolved `global_user_id`;
- retrieve confirmed project memory only for the active project scope;
- preserve group/thread/resource boundaries;
- include only bounded recent dialogue required for continuity;
- include only relevant Self Knowledge categories/facts;
- apply current settings/language/timezone as presentation/context metadata;
- include runtime evidence only when current operational truth is required;
- exclude secrets, credentials and unrelated private data;
- enforce deterministic character/token/count budgets;
- preserve enough provenance/status metadata to avoid presenting uncertain/planned data as confirmed current truth.

Whole-store memory dumps, whole-repository dumps and complete Self Knowledge snapshot dumps are forbidden.

### Trust and authority rules

- Identity facts come from Identity Resolver.
- Role/grant facts come from authorization resolvers.
- Owner identity comes from canonical global identity / Owner Security, not user text.
- Self Knowledge provides system facts but cannot grant authority.
- Confirmed Memory provides scoped facts, not permissions.
- Conversation Context provides continuity, not confirmed truth by itself.
- AI output is never promoted into Identity, Role, Grant, Owner or Self Knowledge authority merely because the model stated it.

## Runtime answer rule

For questions such as:

- who are you;
- what is SG;
- what can you do;
- what modules exist;
- what is implemented;
- what remains planned;
- who owns the system;

SG should retrieve bounded Self Knowledge and place the relevant facts into `BoundedResponseContext` before final answer composition.

For user-identity/memory questions such as:

- who am I;
- what do you remember about me;
- what is my role;

SG must use verified identity/role resolution plus authorized confirmed user memory. The model must not guess these facts from conversation wording.

For live-state questions such as:

- is Telegram webhook working now;
- is a provider connected now;
- is a worker healthy now;

SG must use:

```text
Self Knowledge → Runtime/Diagnostics verification → BoundedResponseContext → answer
```

Self Knowledge is not a substitute for live evidence.

## Security boundaries

- Ordinary user text cannot change fundamental Self Knowledge.
- AI output cannot assign owner, role, authority or architecture truth.
- Names, usernames, phrases and commands cannot redefine SG identity.
- Raw secrets must never enter Self Knowledge or Response Context.
- Owner-sensitive facts must use the verified global identity / Owner Security boundary.
- Automatic refresh may update factual state only from approved system sources.
- Architecture/governance changes still require the authority defined by SG governance and Owner Security.
- Response Context assembly cannot broaden identity, project, group, thread or resource scope.
- Prompt instructions cannot override resolved Identity/Scope/Role/Owner facts.

## Observability

Every material rebuild must record, without exposing secrets:

- rebuild reason;
- source revision;
- previous/new Self Knowledge version;
- changed categories;
- validation/consistency result;
- detected conflicts;
- trace/revision metadata.

Response Context diagnostics may record only bounded metadata, for example:

- included layer names;
- record counts;
- Self Knowledge revision;
- context budget/truncation decision;
- provenance/trust summary;
- runtime evidence source identifiers.

Do not log unrestricted private content, complete prompts or secrets.

## Required response behaviors

After implementation:

- `Кто ты?` resolves from canonical SG identity/Self Knowledge;
- `Что такое СГ?` resolves from Self Knowledge rather than generic model identity;
- `Кто я?` resolves from verified global identity/profile/confirmed memory;
- `Что ты обо мне помнишь?` returns only authorized confirmed memory;
- follow-up questions use bounded current conversation context;
- different users cannot contaminate one another's response context;
- model text cannot convert a guest into Monarch or redefine the owner;
- missing or uncertain context is stated as unknown/uncertain rather than invented.

## Non-goals

Self Knowledge and Response Context must not:

- become a second reasoning engine;
- bypass Semantic Kernel, Decision Engine or Action Gate;
- replace Identity, Memory, Diagnostics or Observability;
- infer implementation from roadmap text alone;
- grant permissions or authority;
- modify code or architecture by themselves;
- create a parallel durable copy of user/project memory.

## Required result

After implementation, SG must be able to produce a concise, consistent and evidence-aware self-description and personalized answer from current authorized system/user context while clearly distinguishing working, partial, planned, disabled, broken and unknown capabilities.
