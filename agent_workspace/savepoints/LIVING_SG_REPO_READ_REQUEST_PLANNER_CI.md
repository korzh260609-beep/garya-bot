# SAVEPOINT — Living SG Repo Read Request Planner CI

Saved at: `2026-05-01T18:05:00Z`
Saved by: `SG-advisor`
Scope: `Living SG repo-read request planner skeleton + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Define a repo-read request planner contract without connecting repo-read runtime.
```

---

## Confirmed principle

```text
Living SG may plan that repository facts are needed.
Planning repo-read is not repo-read execution.
Planner output cannot prove repository status.
Planner output cannot prove file contents.
Planner output cannot authorize writes.
Verified repository/source claims still require sourceResult/system evidence and source proof.
Missing source result must remain source-honest.
Repository write remains blocked.
```

---

## Important commits in this block

```text
d3b74e5e354aa56c3b6cded8e8265083dd75557a
- Added src/core/living-sg/LivingRepoReadRequestPlan.js.
- Defined a planning-only repo-read request contract.
- Separated repo-read planning from repo-read execution.
- Kept repo write blocked.

6b37afda5d95bee78add8a46cb159cc51be0e330
- Added scripts/smokeLivingSGRepoReadRequestPlanner.js.
- Smoke verifies planner can request repo facts without reading repo.
- Smoke verifies planner output cannot prove repo facts.
- Smoke verifies repo write remains blocked.

1b439cddef9b35d51bc6a2967f13963abc376d9d
- Added npm script smoke:living-sg-repo-read-planner.

028b76d89ecd284702ae016368445a290267e545
- Added GitHub Actions workflow Smoke Living SG Repo Read Planner.

768370fe96b7af8a9e4bd57efe278804b9bd32ec
- Merged PR #28 into main.
```

---

## PR

```text
PR: #28
Title: Add Living SG repo-read request planner skeleton
Status: merged
Merge commit: 768370fe96b7af8a9e4bd57efe278804b9bd32ec
```

---

## Verified CI behavior

Monarch visually confirmed in GitHub Actions that PR #28 / merge commit is green.

Meaning:

```text
- LivingRepoReadRequestPlan skeleton imports successfully.
- Planner can decide that repo facts are needed.
- Planner does not read repository.
- Planner does not call sources.
- Planner output cannot prove repo facts.
- Planner output cannot authorize writes.
- Missing source result remains source-honest.
- Repo write remains blocked.
```

---

## Safe status

```text
executor: not created
repo-read runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
runtime: not changed
deploy: not performed
```

---

## Current completed microstep

```text
Living SG repo-read request planner skeleton and CI smoke guard are complete and green.
```

---

## Next safe microstep

```text
Design the future sourceResult envelope contract for repo-read results:
- source result must be explicit, structured, and runtime-provided;
- source result must include source kind, freshness, target, payload, and confirmation status;
- source result envelope must be separate from planner metadata;
- missing/invalid source result must not allow verified repo claims;
- no runtime source calls yet.
```

Recommended check:

```text
- SourceResult envelope can represent verified repo facts.
- SourceResult envelope can represent missing/stale/invalid source evidence.
- Envelope metadata cannot authorize writes.
- Envelope does not execute anything.
```

---

## Warnings

```text
Do not connect Human Meaning Provider yet.
Do not connect RepoStateAgent runtime yet.
Do not add executor.
Do not add repo-read runtime yet.
Do not expand Technical Mode.
Do not add slash commands.
Do not deploy unless explicitly requested by Monarch.
```