# Block 16.17 — Self Knowledge / System Self-Awareness

**Status:** Planned.

## Goal

Give SG a durable, structured and verifiable model of itself so it can answer what SG is, what it can do, what is implemented, what is planned and what its current limitations are without guessing from model context or re-reading the whole repository on every request.

## Scope

Block 16.17 introduces a dedicated Self Knowledge subsystem separate from user memory and project memory.

Required components:

- dedicated `system_self_knowledge` persistence boundary;
- structured self-knowledge records with provenance;
- `SelfKnowledgeBuilder`;
- `SelfKnowledgeConsistencyChecker`;
- canonical capability/module status model;
- revision-bound snapshots;
- bounded retrieval for self-description/system-capability questions;
- runtime verification handoff for live-state questions;
- secret-safe observability for rebuilds and conflicts;
- explicit security boundary preventing user/model text from redefining SG identity or ownership.

## Canonical knowledge domains

At minimum:

- identity;
- purpose;
- owner;
- architecture;
- capabilities;
- modules;
- integrations;
- roles;
- security;
- memory;
- task/automation system;
- sources;
- AI models/providers;
- deployment;
- development status;
- limitations;
- planned features.

## Canonical statuses

Every capability or subsystem claim must use one of:

- `implemented`
- `partial`
- `planned`
- `disabled`
- `broken`
- `unknown`

Planned/disabled/broken/unknown features must never be presented as currently working.

## Authoritative inputs

Self Knowledge may consume only approved SG sources, including:

- `pillars/DECISIONS.md`;
- `pillars/SG_ENTITY.md`;
- active architecture documents;
- active roadmap/module documents;
- actual implementation/configuration composition;
- schema/migration evidence where relevant;
- tests, diagnostics and runtime evidence;
- verified connection/integration state.

Documentation alone is insufficient to assert live implementation status.

## Builder behavior

`SelfKnowledgeBuilder` must:

1. collect approved source facts;
2. compare intended state with implementation evidence;
3. normalize facts into structured records;
4. attach provenance, status and revision metadata;
5. detect material conflicts;
6. persist a versioned snapshot;
7. avoid duplicate snapshots when nothing material changed.

It must not copy the whole repository into prompts or ordinary memory.

## Consistency checking

`SelfKnowledgeConsistencyChecker` must detect at least:

- completed roadmap item with missing implementation;
- implemented subsystem still marked planned;
- integration declared but not actually connected/configured;
- migration/schema mismatch;
- stale snapshot revision;
- conflicting active canonical documents.

Unresolved conflicts must downgrade affected facts to uncertain/unknown and prevent confident claims.

## Persistence/versioning

Each material snapshot must preserve:

- version;
- created timestamp;
- source revision;
- Git commit SHA;
- environment;
- validation status;
- provenance for material facts.

## Runtime use

For self-description/system-capability questions, SG should retrieve bounded Self Knowledge first.

For live operational questions, use:

```text
Self Knowledge → Runtime/Diagnostics verification → answer
```

Self Knowledge is durable system context, not live-health proof.

## Security boundaries

- user messages cannot rewrite SG identity, owner or architecture truth;
- AI output is never an authority source for owner/role/architecture state;
- raw secrets never enter Self Knowledge;
- owner-sensitive facts use verified global identity / Owner Security;
- Self Knowledge cannot grant permissions or bypass Action Gate;
- automatic rebuilds may only consume approved system sources.

## Observability

Record every material rebuild with:

- reason;
- source revision;
- previous/new version;
- changed categories;
- conflicts;
- validation result;
- trace metadata.

No raw secrets or unrestricted private data may be logged.

## Acceptance criteria

- [ ] dedicated Self Knowledge storage is separate from user/project memory;
- [ ] canonical identity/purpose/owner/architecture facts are queryable;
- [ ] capabilities/modules/integrations expose one canonical status;
- [ ] builder creates deterministic revision-bound snapshots;
- [ ] no-op rebuild does not create duplicate state;
- [ ] roadmap-vs-code conflicts are detected and surfaced;
- [ ] stale revision is detected;
- [ ] self-description answers do not require full-repository prompt injection;
- [ ] planned/disabled/broken/unknown features are never claimed as working;
- [ ] live-state questions can invoke runtime/diagnostics verification;
- [ ] user/model prompt injection cannot alter canonical owner/identity facts;
- [ ] secret-leakage tests pass;
- [ ] restart persistence works;
- [ ] cross-user data cannot contaminate System Self Knowledge;
- [ ] observability records rebuilds and conflicts safely;
- [ ] unit, integration, persistence and runtime tests pass.

## Dependencies

Depends on completed:

- Context and Memory;
- Identity and Scope;
- Observability;
- Runtime Composition;
- PostgreSQL Persistence;
- Production Capabilities;
- Configuration & Policy;
- External Connections Registry;
- Resource Ownership & Authority;
- Schema & Contract Versioning.

Block 16.17 must complete before Block 16.18 so Owner Security can operate against a consistent canonical system model without becoming the Self Knowledge subsystem itself.

## Architecture reference

`pillars/architecture/SELF_KNOWLEDGE.md`
