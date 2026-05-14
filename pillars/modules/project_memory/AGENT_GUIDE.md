# project_memory AGENT_GUIDE

> AGENT NOTE:
> This is the stable operating guide for agents working on SG 2.0 Project Memory.
> It is not a progress tracker and must not be used as proof of what currently exists in code, DB, Render, or production.

---

## 1. Purpose

This guide prevents agents from confusing planning notes, old search results, documentation labels, runtime helpers, and live production facts.

Project Memory work must be source-first and verification-first.

```text
read the guide -> verify current branch files -> verify runtime facts when needed -> then plan the next change
```

---

## 2. Non-status rule

Do not store mutable progress lists in this module documentation.

Avoid sections named like:

```text
what is done
what is not done
current status
todo checklist
completed
not implemented
```

Reason:

```text
progress changes faster than documentation
stale status makes agents choose the wrong next action
repository files and runtime diagnostics are the source of current truth
```

---

## 3. Required verification before work

Before changing Project Memory, verify the active branch directly.

Minimum read set:

```text
pillars/modules/project_memory/README.md
pillars/modules/project_memory/CONTRACTS.md
pillars/modules/project_memory/RISKS.md
pillars/modules/project_memory/DATA_MODEL.md
pillars/modules/project_memory/AGENT_GUIDE.md
src/memory/index.js
src/memory/project/
src/memory/policies/projectMemoryPolicy.js
src/core/message/*ProjectMemory*
src/app/projectMemoryBootstrap.js
package.json
```

Do not rely on:

```text
GitHub search index
old commits
old chat summaries
old PR descriptions
memory snapshots
file names from another branch
```

---

## 4. How to determine the next step

Use this decision order:

1. Current Monarch instruction.
2. Current verified `dev/v2-start` files.
3. Current runtime diagnostics / Render / DB evidence when the task depends on runtime state.
4. Approved pillars and module contracts.
5. This guide.
6. Prior chat context.
7. AI inference.

If any source conflicts, warn before acting.

---

## 5. Stable Project Memory boundaries

Project Memory supports project continuity.

It must not become:

```text
source of truth above pillars/repo/runtime
raw chat archive
Telegram-coupled memory layer
AI self-writing memory loop
secret store
raw log store
autonomous hidden worker
```

Project Memory may only use confirmed, bounded, source-aware project facts as support context.

---

## 6. Migration/schema decision rule

When working on Project Memory storage, always separate these concerns:

```text
schema definition
schema bootstrap
formal migration workflow
live DB verification
production readiness claim
```

Rules:

- Runtime schema bootstrap may be a gated helper.
- Formal migrations, if introduced, must be treated as the production DB change path.
- Bootstrap must not silently replace migration governance.
- Live DB readiness must be verified from runtime/DB evidence, not from docs.

---

## 7. Write safety rule

Do not add any of the following without explicit Monarch approval:

```text
automatic write from chat
AI direct confirmed writes
source sync
Telegram command that writes Project Memory
prompt injection enabled by default
schema bootstrap enabled by default
autonomous cron/timer memory writes
secret/raw-log/provider dump storage
```

---

## 8. Documentation maintenance rule

Module docs should describe stable boundaries, contracts, risks, data shapes, and operating rules.

They should not require constant edits merely because implementation progresses.

If a work checkpoint is needed, prefer a PR description, issue, or runtime diagnostic output instead of changing module law/docs.

---

## 9. Agent response rule

When asked what exists now, the agent must inspect current files and say:

```text
Verified from active branch: ...
Not verified from active branch: ...
Runtime/DB not verified unless diagnostics were checked: ...
```

Never present this guide as proof of runtime state.
