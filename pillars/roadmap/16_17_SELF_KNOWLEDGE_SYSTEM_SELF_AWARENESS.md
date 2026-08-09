# Block 16.17 — Self Knowledge / System Self-Awareness

**Status:** Planned.

## Goal

Give SG a durable, structured and verifiable model of itself so it can answer what SG is, what it can do, what is implemented, what is planned and what its current limitations are without guessing from model context or re-reading the whole repository on every request.

Block 16.17 also closes the runtime gap between knowledge that SG already resolves internally and knowledge that reaches the final AI response composer. SG must not merely know identity, memory, conversation and self-knowledge facts internally; it must assemble a bounded, scope-safe response context and provide that context to the AI Router for answer composition when relevant.

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
- `BoundedResponseContext` / response-context assembly boundary;
- runtime integration of Self Knowledge, Identity, confirmed Memory, Conversation Context and User Settings into final answer composition;
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

## Runtime Response Context Integration

Block 16.17 must introduce one explicit response-context assembly boundary before final AI answer composition.

Canonical flow:

```text
Transport input
→ Identity Resolver
→ Scope Resolver
→ Context Resolver
→ Conversation Context
→ Self Knowledge Resolver
→ User Settings / Language / Timezone
→ BoundedResponseContext
→ AI Router
→ Response Composer
→ answer
```

The final Response Composer must not receive only raw user text and language metadata. When relevant and authorized, it must receive a bounded structured context assembled by SG.

### Required context sources

`BoundedResponseContext` may contain only already-resolved, scope-safe data from:

- verified `global_user_id`;
- verified roles/grants as informational context only;
- confirmed user memory;
- confirmed project memory for the active project scope;
- bounded recent conversation context;
- relevant System Self Knowledge;
- user settings and presentation preferences;
- language/locale context;
- timezone/temporal context;
- relevant runtime/diagnostic evidence when the question requires live state.

### Mandatory trust rules

- Identity Resolver, not the model, determines `global_user_id`.
- Role/grant resolvers, not the model, determine roles and permissions.
- `MONARCH_GLOBAL_USER_ID` / Owner Security remains authoritative for owner identity.
- The model may describe a verified role but may never assign, change or infer authority from names, usernames, phrases or conversation text.
- User Memory and Project Memory must be filtered by identity/scope/permission before prompt composition.
- Conversation Context must remain bounded and must not automatically become confirmed memory.
- Self Knowledge is system truth only within its provenance/status/revision constraints.
- Raw secrets and credential values are forbidden in `BoundedResponseContext`.

### Context selection and limits

The response-context assembler must:

1. determine which context layers are relevant to the current request;
2. retrieve only those layers;
3. enforce user/project/group/thread scope before inclusion;
4. enforce a deterministic token/character budget;
5. rank current confirmed facts above stale/superseded data;
6. preserve provenance/trust metadata where needed;
7. exclude unrelated private memory;
8. never dump whole memory stores, repository files or Self Knowledge snapshots into the model prompt.

### Required user-facing behavior

After implementation:

- `Кто ты?` / equivalent must resolve SG identity from Self Knowledge;
- `Что такое СГ?` must use canonical System Self Knowledge;
- `Кто я?` must use verified identity + confirmed user memory/profile rather than generic model guessing;
- `Что ты обо мне помнишь?` must use only authorized confirmed user memory;
- project questions may use confirmed Project Memory only inside the correct project scope;
- follow-up questions may use bounded Conversation Context;
- live operational questions must combine Self Knowledge with Runtime/Diagnostics evidence;
- if required context is unavailable or uncertain, the answer must state that limitation instead of inventing facts.

## Security boundaries

- user messages cannot rewrite SG identity, owner or architecture truth;
- AI output is never an authority source for owner/role/architecture state;
- raw secrets never enter Self Knowledge or response context;
- owner-sensitive facts use verified global identity / Owner Security;
- Self Knowledge cannot grant permissions or bypass Action Gate;
- automatic rebuilds may only consume approved system sources;
- response-context assembly cannot broaden user/project/group/thread scope;
- prompt content cannot override verified Identity, Scope, Role, Grant or Owner Security facts.

## Observability

Record every material rebuild with:

- reason;
- source revision;
- previous/new version;
- changed categories;
- conflicts;
- validation result;
- trace metadata.

Response-context diagnostics must record only bounded metadata such as included context layer names, counts, revision/provenance identifiers and truncation decisions. Raw secrets and unrestricted private content must not be logged.

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
- [ ] `BoundedResponseContext` is assembled before final AI response composition;
- [ ] Response Composer receives relevant Self Knowledge when answering `who are you / what is SG / what can you do` questions;
- [ ] Response Composer receives verified identity and authorized confirmed user memory for `who am I / what do you remember about me` questions;
- [ ] confirmed Project Memory is included only inside the matching project scope;
- [ ] bounded Conversation Context supports follow-up continuity without becoming confirmed memory;
- [ ] user settings, language and timezone can influence presentation without granting authority;
- [ ] model output cannot assign or modify identity, role, grant or owner status;
- [ ] two users cannot receive each other's private response context;
- [ ] group/thread/project boundaries remain isolated during response composition;
- [ ] context size is bounded and whole-store/repository prompt dumping is prohibited;
- [ ] missing/uncertain context produces an explicit limitation instead of hallucinated identity or memory;
- [ ] integration tests cover `Кто ты?`, `Что такое СГ?`, `Кто я?`, `Что ты обо мне помнишь?`, conversation continuation, monarch vs guest and two-user isolation;
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
- Production AI Integration / AI Router;
- Production Capabilities;
- Language & Locale Context;
- Temporal Context;
- Session & Conversation Context;
- User Settings & Preferences;
- Configuration & Policy;
- External Connections Registry;
- Resource Ownership & Authority;
- Schema & Contract Versioning.

Block 16.17 must complete before Block 16.18 so Owner Security can operate against a consistent canonical system model without becoming the Self Knowledge subsystem itself.

## Architecture reference

`pillars/architecture/SELF_KNOWLEDGE.md`
