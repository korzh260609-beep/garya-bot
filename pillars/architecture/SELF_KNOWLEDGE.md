# SG 2.1 — SELF KNOWLEDGE / SYSTEM SELF-AWARENESS

## Purpose

Define how SG maintains a current, verifiable and durable model of itself without treating raw documentation, model output or user text as system truth.

Self Knowledge is a platform subsystem. It is not a personality layer and it is not ordinary user/project memory.

## Canonical separation

```text
User Memory          = facts about one user
Project Memory       = facts about user/project work
System Self Knowledge = facts about SG itself
Runtime Evidence     = live confirmation of current operational state
```

These layers must remain separate.

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

## Runtime answer rule

For questions such as:

- who are you;
- what is SG;
- what can you do;
- what modules exist;
- what is implemented;
- what remains planned;
- who owns the system;

SG should first use bounded Self Knowledge instead of re-reading the whole repository.

For live-state questions such as:

- is Telegram webhook working now;
- is a provider connected now;
- is a worker healthy now;

SG must use:

```text
Self Knowledge → Runtime/Diagnostics verification → answer
```

Self Knowledge is not a substitute for live evidence.

## Security boundaries

- Ordinary user text cannot change fundamental Self Knowledge.
- AI output cannot assign owner, role, authority or architecture truth.
- Names, usernames, phrases and commands cannot redefine SG identity.
- Raw secrets must never enter Self Knowledge.
- Owner-sensitive facts must use the verified global identity / Owner Security boundary.
- Automatic refresh may update factual state only from approved system sources.
- Architecture/governance changes still require the authority defined by SG governance and Owner Security.

## Observability

Every material rebuild must record, without exposing secrets:

- rebuild reason;
- source revision;
- previous/new Self Knowledge version;
- changed categories;
- validation/consistency result;
- detected conflicts;
- trace/revision metadata.

## Non-goals

Self Knowledge must not:

- become a second reasoning engine;
- bypass Semantic Kernel, Decision Engine or Action Gate;
- replace Identity, Memory, Diagnostics or Observability;
- infer implementation from roadmap text alone;
- grant permissions or authority;
- modify code or architecture by itself.

## Required result

After implementation, SG must be able to produce a concise, consistent and evidence-aware self-description from current system knowledge, while clearly distinguishing working, partial, planned, disabled, broken and unknown capabilities.
