# REPO_MAP_SOURCE_POLICY.md

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

## Legacy status

Old repo/index/map mechanisms are legacy.

Legacy systems must not be used as factual truth for:

- current repository state
- project map
- semantic map
- module grouping
- architecture health
- project completion/status claims

## Legacy allowed usage

Legacy systems may remain temporarily only for:

- compatibility
- quick file browsing
- old command support
- fallback read-only access
- migration reference

They must be removed or adapted gradually.

## Migration rule

When old code conflicts with RepoStateAgent, RepoStateAgent wins.

Old code must be handled in one of three ways:

1. adapt it to call/use RepoStateAgent;
2. downgrade it to explicit legacy/fallback behavior;
3. remove it carefully after replacement is verified.

## Forbidden

Do not present old RepoIndex, old manual grouping, old hardcoded maps, or old command outputs as current project truth.

Do not copy old grouping/indexing logic into the new agent unless it is verified against real repository state.

## Practical target

All future project-map and semantic-map work must move toward:

```text
SG/user request
-> SG
-> RepoStateAgent
-> verified project/semantic map
-> SG human-language answer
```
