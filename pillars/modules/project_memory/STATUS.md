# project_memory STATUS

> AGENT NOTE:
> This file records the current audited state and near-term work plan for the SG 2.0 Project Memory module.
> Read this file before continuing Project Memory work so the work does not restart from old assumptions.
> This file is a planning/status aid only. It must not override current Monarch instructions, pillars, verified repository files, runtime diagnostics, or live DB facts.

Статус: V1 RUNTIME SKELETON / NOT FULL PRODUCTION MEMORY

---

## 1. Purpose of this file

This file fixes the current understanding of what has already been done and what is still missing in `project_memory`.

Goal:

```text
avoid repeated re-analysis
avoid false assumptions
continue Project Memory work from the real current state
```

Hard rule:

```text
Before changing Project Memory, verify current files in dev/v2-start.
Do not rely on GitHub search index or old commits as proof of current branch state.
```

---

## 2. What is already done

1. Project Memory is separated as its own module.
2. Boundaries, contracts, risks and data model are documented.
3. Type model exists: `type`, `scope`, `trust`, `sourceType`.
4. SG project memory is separated from user project memory.
5. Prepare-only `ProjectMemoryService` exists.
6. Runtime schema helper exists without a `migrations/` folder.
7. Durable store exists for candidate / confirm / list.
8. Explicit manual candidate flow exists.
9. Explicit confirmation flow exists.
10. Confirmed-only read flow exists.
11. Runtime context bridge exists.
12. Message read bridge exists.
13. Message context gate exists with env flags.
14. Schema bootstrap exists with env flags.
15. User project validator exists.
16. Policy exists: source-first, no secrets, no raw logs, no AI direct writes.
17. Smoke commands exist for checks.

---

## 3. What is not done yet

1. No `migrations/` folder exists in `dev/v2-start`.
2. No migration workflow exists for Project Memory.
3. No automatic write from chat exists.
4. No AI auto-write exists.
5. No source sync exists.
6. No Telegram commands exist for Project Memory.
7. Prompt injection is not enabled by default.
8. Schema bootstrap is not enabled by default.
9. There is no verified proof here that Project Memory tables exist in the live Render DB.
10. There is no full production flow where memory continuously works by itself.

---

## 4. Exact current formula

```text
Project Memory in dev/v2-start = V1 Runtime Skeleton.

It has:
- architecture docs;
- contracts;
- risk model;
- data model;
- runtime schema helper;
- durable candidate store;
- explicit confirmation;
- confirmed-only read;
- runtime context bridge;
- optional message context gate;
- smoke coverage.

It does not yet have:
- migrations;
- automatic chat memory extraction;
- AI auto-write;
- source sync;
- Telegram commands;
- enabled prompt injection by default;
- verified live DB deployment proof;
- full production memory loop.
```

---

## 5. Safe next work order

Project Memory work must continue in this order unless the Monarch explicitly changes it:

1. Re-check current `dev/v2-start` files.
2. Decide whether Project Memory should use:
   - runtime schema bootstrap only;
   - a formal migration workflow;
   - both, with clear boundaries.
3. Verify live Render DB state before claiming production readiness.
4. Add diagnostics/read-only status command only after scope approval.
5. Add candidate creation path only through explicit manual command/flow.
6. Add confirmation path only through explicit Monarch-approved flow.
7. Only after that discuss source sync or AI-assisted candidates.
8. Keep AI auto-write and chat auto-write disabled until separately approved.

---

## 6. Forbidden assumptions

Do not assume:

```text
migrations exist
schema exists in live DB
prompt injection is enabled
Project Memory writes from chat
AI can write confirmed memory
Project Memory is production-ready
old search results equal current branch files
```

---

## 7. Source-of-truth reminder

Authority order remains:

1. Current Monarch instruction.
2. Approved pillars and module docs.
3. Verified repository files in the active branch/ref.
4. Verified runtime diagnostics / Render / DB facts.
5. Confirmed Project Memory entries.
6. Current chat context.
7. AI inference.

Project Memory supports continuity.
It does not replace verification.
