# SAVEPOINT — RepoStateAgent-only Living Layer Decision Merged

Saved at: `2026-05-02T09:45:00+03:00`
Saved by: `SG-advisor`
Scope: `Savepoint after PR #53 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #53 — Decide RepoStateAgent-only path for Living SG repo facts
Merge commit: 49d654e406dfa2d3f9e744b8d4435a68c4b0fe6e
Previous merged PR: #52 — Add Living legacy snapshot provider result shape skeleton
Previous merge commit: f65b236cef7a110653c1909a48f9dba9c08e49d5
```

---

## Simple decision

```text
Living SG must use RepoStateAgent for current repo/project facts.
Old RepoIndex must not be used as the living source of truth.
```

---

## New living path

```text
RepoStateAgent
-> current project map
-> semantic map
-> Living SG answer
```

---

## Old path status

```text
RepoIndex
-> Technical Mode only
-> legacy fallback only
-> diagnostics only
-> migration reference only
```

Old RepoIndex is not equal to RepoStateAgent.
Old RepoIndex must not be treated as current project truth.
Old RepoIndex must not be treated as current semantic map.
Old RepoIndex must not be developed as the main Living SG path.

---

## Files changed by PR #53

```text
pillars/DECISIONS.md
pillars/architecture/REPO_MAP_SOURCE_POLICY.md
```

---

## Current safe status after PR #53

```text
runtime: not changed
DB: not changed
repo-read runtime: not changed
repo-write runtime: not connected
executor: not created
RepoStateAgent runtime: not newly connected
Human Meaning Provider: not connected
Technical Mode: not expanded
slash commands: not added
deploy: not performed
```

---

## Important warning

```text
Do not continue building old RepoIndex as the Living SG path.
Do not combine old RepoIndex and RepoStateAgent as equal sources of truth.
Do not present old snapshot data as current verified repo/project truth.
```

---

## Next safe microstep

Read-only inspection of the real RepoStateAgent path:

```text
1. Check RepoStateAgentService.
2. Check RepoStateCollector.
3. Check RepoStateProjectMapBuilder.
4. Check where semanticMap is built or stored.
5. Check how projectMapState is saved and reused.
6. Check whether current map updates after repo changes.
```

No runtime connection yet.
No deploy.
No executor.
No old RepoIndex as Living SG truth.
