# REPO_MAP_SOURCE_POLICY.md

## Purpose

This file defines the factual source policy for current repository state, project map, semantic map, module grouping, and architecture-health claims.

It is an architecture-level implementation of:

- `pillars/SG_ENTITY.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`

---

## Entity alignment

SG is the global project entity.

RepoStateAgent is not a separate SG, not an autonomous project owner, and not an independent source of decisions.

RepoStateAgent is SG’s factual repository observation subsystem.

Its role is to observe and structure current repository state so SG can reason and answer from verified facts.

Correct relation:

```text
SG global project entity
-> RepoStateAgent factual observation subsystem
-> verified repo/project/semantic map
-> SG decision-support response
```

Incorrect relation:

```text
RepoStateAgent = SG itself
RepoStateAgent = autonomous architect
RepoStateAgent = decision maker
old RepoIndex = current factual truth
```

---

## Core rule

The only factual source of truth for the current repository state is the new RepoStateAgent pipeline.

Current factual repository state must come from:

```text
RepoStateAgent
-> RepoStateCollector
-> RepoStateProjectMapBuilder
-> RepoStateSemanticMapBuilder
-> reports/state saved by the new agent
```

This applies to claims about:

- current repository state
- current project map
- current semantic map
- module grouping
- architecture health
- project completion/status claims
- Human Mode repo/project answers

---

## Source-first alignment

This policy follows the source-first principle from `PROJECT.md` and `SG_BEHAVIOR.md`.

For repository/project work:

```text
meaning resolution
-> source selection
-> RepoStateAgent factual read
-> capability/action selection
-> SG answer
```

AI reasoning or model memory must not replace repository facts.

If RepoStateAgent facts are unavailable, SG must say that factual repo state is unavailable instead of pretending that old maps, memory, or chat history are current truth.

---

## Legacy status

Old repo/index/map mechanisms are legacy.

Legacy systems must not be used as factual truth for:

- current repository state
- project map
- semantic map
- module grouping
- architecture health
- project completion/status claims

Legacy includes:

```text
old RepoIndex
old repo maps
old manual grouping
old hardcoded maps
old command outputs
old snapshot-only replies
legacy phrase routes
legacy regex routes
```

---

## Legacy allowed usage

Legacy systems may remain temporarily only for:

- compatibility
- quick file browsing
- old command support
- fallback read-only access
- migration reference
- explicit Technical Mode diagnostics

They must be removed or adapted gradually.

They must never be presented as current factual repository truth.

---

## Migration rule

When old code conflicts with RepoStateAgent, RepoStateAgent wins for factual current repository state.

Old code must be handled in one of three ways:

1. adapt it to call/use RepoStateAgent;
2. downgrade it to explicit legacy/fallback behavior;
3. remove it carefully after replacement is verified and Monarch approves.

This migration must follow `DECISIONS.md` governance:

- no architecture change on the fly
- skeleton -> config -> logic
- system correctness overrides AI intelligence
- AI/tools may suggest, but Monarch decides

---

## Forbidden

Do not present old RepoIndex, old manual grouping, old hardcoded maps, or old command outputs as current project truth.

Do not copy old grouping/indexing logic into the new agent unless it is verified against real repository state.

Do not treat RepoStateAgent as a separate SG or autonomous decision maker.

Do not let model memory, chat history, or stale snapshots override verified repo facts.

Do not connect RepoStateAgent to Human Mode runtime without explicit gated architecture and smoke-check coverage.

---

## Practical target

All future project-map and semantic-map work must move toward:

```text
SG/user request
-> SG Human Mode meaning/context/permissions
-> RepoStateAgent
-> verified project/semantic map
-> SG capability/action selection
-> SG human-language answer
```

Technical Mode may expose RepoStateAgent diagnostics, but those diagnostics remain technical/control surfaces, not SG’s normal user-facing intelligence layer.

---

## Current implementation alignment

Current safe Human Mode work is aligned with this policy only if:

- Human Mode runtime is still gated or not connected;
- raw text is not classified through phrase/keyword/regex logic;
- repo facts are loaded from `context.repoStateAgentResult` or gated runner only;
- `repoStateAgentRunner` runs only when `allowHumanRepoStateAgentRun === true`;
- real RepoStateAgentService is lazy-imported only when needed;
- smoke-check validates the contract.
