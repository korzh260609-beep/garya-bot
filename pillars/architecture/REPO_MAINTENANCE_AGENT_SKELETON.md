# REPO_MAINTENANCE_AGENT_SKELETON.md — Future Repo Maintenance Agent

> AGENT NOTE:
> This file defines a future read-only Repo Maintenance Agent skeleton for SG 2.0.
> Read it before creating repo maintenance automation, post-change audit, docs sync checks, or snapshot planning.
> Do not let this agent auto-edit code, pillars, workflow, or repo state without explicit Monarch approval.

Статус: FUTURE SKELETON

---

## Purpose

Future Repo Maintenance Agent should help after repository changes by checking:

- what files changed;
- what docs may need updates;
- what tests/smoke checks should run;
- whether workflow/pillars are still aligned;
- whether a snapshot/backup is needed;
- what risk remains.

---

## Initial authority

Read-only auditor/planner.

Allowed:

- inspect repo facts;
- compare changed files;
- suggest follow-up checks;
- suggest docs updates;
- suggest snapshot/backup.

Forbidden without approval:

- edit code;
- edit pillars;
- create commits;
- create PRs;
- deploy;
- change external state.

---

## Difference from Repo facts provider

Repo facts provider observes current repository state.
Repo Maintenance Agent reasons about what should be checked after changes.

They must not be merged into one hidden monolith.
