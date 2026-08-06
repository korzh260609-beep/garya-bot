# PILLARS — SG 2.1 CANONICAL INDEX

## Purpose

`pillars/` is the canonical documentation system for SG 2.1.

It defines the intended system, architecture, development order and implementation discipline. It does not describe completion status unless that status is generated from code, tests or runtime evidence.

## Authority hierarchy

```text
DECISIONS
→ ARCHITECTURE
→ ROADMAP
→ WORKFLOW
→ CODE
→ TEST / RUNTIME EVIDENCE
```

Interpretation rules:
- `pillars/DECISIONS.md` is the highest source for accepted global decisions.
- Verified code/runtime evidence describes what currently exists but does not redefine intended architecture.
- Lower layers cannot silently override higher layers.
- Chat, memory, summaries and archive material are supporting context only.

## Active root pillars

Only these root files are canonical for SG 2.1:

1. `DECISIONS.md` — accepted global decisions and governance
2. `SG_ENTITY.md` — what SG is and is not
3. `SG_BEHAVIOR.md` — how SG reasons, responds and controls actions
4. `PROJECT.md` — project purpose, system model and success criteria
5. `README.md` — this authority and reading index

Any other root-level pillar file is supporting, historical or inactive unless it is explicitly promoted through an accepted decision and added to this list.

## Active architecture

Entry point: `pillars/architecture/README.md`

Canonical architecture documents:
- `SG21_SYSTEM.md`
- `SEMANTIC_KERNEL.md`
- `CONTEXT_AND_MEMORY.md`
- `DECISION_AND_ACTION_GATE.md`
- `CAPABILITY_SYSTEM.md`
- `TRANSPORTS_AND_AI_ROUTING.md`

Architecture defines how SG 2.1 is structured. It must not contain roadmap order, deployment history or manual status markers.

Any architecture file not listed above is legacy, supporting or inactive and cannot override the canonical architecture set.

## Active roadmap

Entry point: `pillars/roadmap/README.md`

Roadmap defines only:
- what is built;
- dependency order;
- stage gates;
- acceptance boundaries.

Roadmap does not contain implementation procedure, runtime history, deployment notes or manual completion status.

Canonical order:

```text
Constitution
→ Semantic Kernel
→ Context and Memory
→ Decision and Safety
→ Capability System
→ Interfaces
→ Automation and Agents
→ Domain Modules
```

## Active workflow

Entry point: `pillars/workflow/README.md`

Workflow defines only how one selected roadmap item is implemented safely.

Workflow does not choose the next stage and does not duplicate roadmap content.

Canonical implementation discipline:

```text
restore context
→ select roadmap item
→ read architecture
→ define scope and acceptance criteria
→ skeleton
→ config
→ minimal logic
→ tests
→ observability
→ safety
→ evidence
→ reversible commit
```

## Canonical SG 2.1 model

```text
SG = transport-independent project system
   + connected reasoning model
   + semantic kernel
   + context and memory
   + sources and capabilities
   + permissions and action gates
   + replaceable transports
```

The connected AI model provides reasoning and language intelligence.

SG code provides:
- context;
- memory;
- sources;
- tools;
- capabilities;
- identity;
- permissions;
- confirmations;
- controlled execution;
- transport delivery;
- observability.

## Transport independence

Telegram, Discord, Web/API, email, voice, IDE and future interfaces are transports or integrations, not SG itself.

All transports connect to the same SG core and resolve the same person through `global_user_id`.

No transport may own:
- semantic interpretation;
- durable memory;
- permissions policy;
- capability selection;
- domain business logic;
- SG identity.

## Meaning-first rule

```text
input
→ meaning
→ intent and goal
→ context
→ capability
→ action classification
→ action gate
→ execution or answer
```

Phrase, keyword, regex and command routing may be auxiliary only. They cannot become the reasoning core.

## Controlled-action rule

SG distinguishes:
- read-only;
- analysis-only;
- prepare-only;
- state-changing;
- external-action;
- private-data;
- expensive-costly actions.

Analysis and preparation may continue when execution is blocked. Protected execution requires permission and confirmation where applicable.

## Legacy and archive rule

Old SG 2.0 roadmap, workflow, runtime notes, command maps, old architecture experiments and repository snapshots are not active SG 2.1 truth.

They may remain:
- in Git history;
- under `archive/`;
- as explicitly marked supporting references.

They must not be used to define current architecture or development order.

## Reading order before development

1. `pillars/README.md`
2. `pillars/DECISIONS.md`
3. `pillars/SG_ENTITY.md`
4. `pillars/SG_BEHAVIOR.md`
5. `pillars/PROJECT.md`
6. `pillars/architecture/README.md`
7. relevant architecture contracts
8. `pillars/roadmap/README.md`
9. current roadmap block
10. `pillars/workflow/README.md`
11. relevant workflow protocol

## Change rule

A global architecture change requires:
1. explicit monarch approval;
2. accepted entry in `DECISIONS.md`;
3. architecture update;
4. roadmap impact review;
5. implementation through workflow;
6. tests and evidence.

## Start condition for SG 2.1

Development may begin when a selected roadmap item has:
- a clear architecture contract;
- defined scope and non-goals;
- acceptance criteria;
- dependency confirmation;
- test plan;
- safety and observability requirements.

The first implementation target is the transport-independent Semantic Kernel contract and a local test harness, not Telegram integration.