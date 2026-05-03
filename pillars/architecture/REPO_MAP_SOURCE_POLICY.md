# REPO_MAP_SOURCE_POLICY.md — Repository Facts Policy

> AGENT NOTE:
> This file defines how SG 2.0 should treat repository facts and project maps.
> Read it before adding RepoStateAgent, repo search, repo maps, repo snapshots, or project-state answers.
> Do not present stale memory, old snapshots, or guessed repo structure as current truth without verified source data.

Статус: ACTIVE SKELETON

---

## Core rule

Current repository facts must come from verified repository/source access.

Not enough:

- memory;
- chat history;
- old snapshots;
- old main docs;
- guessed paths;
- stale RepoIndex-style maps.

---

## Future target

SG 2.0 may later have RepoStateAgent or equivalent repo facts provider.

Target flow:

```text
repo request
-> repo source provider
-> verified file/tree facts
-> normalized project map
-> AI analysis
-> answer with source awareness
```

---

## Current SG 2.0 rule

Until a repo facts module exists in code, SG must use available GitHub/API source access and clearly state limits.

---

## Forbidden

- inventing repo structure;
- treating old `main` as current `dev/v2-start`;
- using deprecated docs as live repo state;
- answering confidently when repo facts were not checked;
- copying old repo map logic before SG 2.0 skeleton approves it.
