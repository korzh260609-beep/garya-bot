# ROADMAP — RULES AND ORDER

> Active roadmap source for SG project evolution.  
> Purpose: define allowed development order without premature feature jumps.

---

## 0) ACTIVE ROADMAP RULES

- The active roadmap is split under `pillars/roadmap/`.
- Old `pillars/ROADMAP.md` is legacy/inactive when split roadmap files exist.
- Status markers are intentionally not used.
- Order and structure define the development sequence.
- Actual completion must be verified from repository/runtime, not from labels.

---

## 0.1 MEMORY PRIORITY CLARIFICATION

Memory-related roadmap items are split into two groups.

### A) Early memory foundation

These are current priority and belong to early memory stages:

- base memory read/write
- confirmed long-term memory
- raw dialogue archive with strict limits
- topic digest skeleton
- project memory core
- project auto-restore
- session summaries
- local recall for current user/project
- controlled memory read/write

### B) Later memory consumers

These remain in later roadmap stages:

- real GitHub/repo indexing
- memory candidates from repository indexing
- cross-group recall
- group-source memory features
- risk module project_memory integration
- billing/memory dashboard
- legal export/delete/anonymization
- market/risk decision modules using memory

Hard rule:
- Do not move later feature modules earlier only because they mention memory.
- Move earlier only the memory core required for SG to reliably continue project development.

---

## 1) GLOBAL RULES (HARD)

- GLOBAL RULE — AI is execution only, SG is decision maker
- GLOBAL RULE — specialized AI first, reasoning AI last
- GLOBAL RULE — no direct AI calls, only via router
- GLOBAL RULE — every AI call is logged with cost + reason
- GLOBAL RULE — BehaviorCore is independent from AnswerMode (length ≠ style)
- GLOBAL RULE — short/normal/long preserve the same SG personality
- GLOBAL RULE — unclear intent → max 1 soft clarifying question
- GLOBAL RULE — soft form / hard essence (risk-first, no “ты неправ”)
- GLOBAL RULE — skeleton → config → logic for every new capability
- GLOBAL RULE — no architecture changes without explicit decision entry
- GLOBAL RULE — stage gates are strict

---

## 2) ROADMAP FLOW (CANONICAL ORDER)

Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Project Memory Core → Long-Term Memory Core → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

---

## 3) STAGE GATE RULE

- Stage N cannot consume features from Stage N+1.
- Project Memory Core and Long-Term Memory Core must be reliable enough before broad new feature expansion.
- Real external integrations stay gated by their original stages.

---

## 4) EXECUTION ORDER

For any roadmap item:

1. Skeleton
2. Config
3. Logic
4. Observability
5. Safety
6. Manual test
7. Commit
8. Factual roadmap/workflow note if needed

For memory work:

1. Verify read path
2. Verify write path
3. Verify controlled write policy
4. Verify no raw uncontrolled prompt injection
5. Verify restore before project/repo work
