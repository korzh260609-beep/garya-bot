# WORKFLOW.md — SG AI SYSTEM (Strict Roadmap Execution)

> Single source of truth for development order.  
> Purpose: prevent premature decisions, keep skeleton intact, make errors early + cheap.

---

## 0) LEGEND

- Статусы намеренно убраны
- Порядок и структура являются источником истины
- Факт выполнения определяется анализом репозитория и системы, а не маркерами

---

## 0.1 MEMORY ORDER CLARIFICATION

Memory-related items are split into two groups:

1. **Core memory types that SG needs to work correctly**
   - base memory
   - confirmed long-term memory
   - dialogue archive / topic digest skeleton
   - project memory core
   - project auto-restore
   - session summaries
   - local recall for the current user/project

   These belong to the current early memory stages and must be completed before expanding complex features.

2. **Feature-specific integrations that only consume memory**
   - real GitHub/repo indexing
   - memoryCandidates from repository indexing
   - cross-group recall
   - risk module project_memory integration
   - billing/memory dashboard
   - legal export/delete flows
   - market/risk decision modules using memory

   These remain in their original later stages because they are not memory core. They are feature layers that use memory after memory is stable.

Hard rule:
- Do not move a later feature earlier only because it mentions memory.
- Move earlier only the memory core required for SG to reliably continue project development.

---

## 1) HARD RULES (GLOBAL / NON-NEGOTIABLE)

### 1.1 Global behavior rules

1. AI is execution only, SG is decision maker
2. Specialized AI first, reasoning AI last
3. No direct AI calls — only via router
4. Every AI call is logged with cost + reason
5. BehaviorCore is independent from AnswerMode (length ≠ style)
6. short/normal/long preserve the same SG personality
7. Unclear intent → max 1 soft clarifying question
8. Soft form / hard essence (risk-first, no “ты неправ”)

### 1.2 Workflow enforcement rules (how to work)

9. Work order for ANY new capability: **skeleton → config → logic**
10. One change block = one commit (small, reversible).
11. No architecture changes “on the fly”. Architecture changes require explicit revision note in DECISIONS.md.
12. If something is ambiguous, STOP and add a note to DECISIONS.md before implementing.
13. If a step references a later stage, it is forbidden (stage gate).
14. Before continuing repository development, SG must restore current project memory context.
15. Project Memory Core and Long-Term Memory Core are early foundation, not optional future enhancements.

---

## 2) STAGE GATES (ROADMAPPED ORDER)

**Canonical order (must not be reordered):**  
Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Project Memory Core → Long-Term Memory Core → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

**Gate rule:** Stage N cannot consume features from Stage N+1.

Memory gate rule:
- No major new feature work should continue until Project Memory Core and Long-Term Memory Core are reliable enough for SG to restore current project state, decisions, constraints, risks, and next steps.

---

## 3) EXECUTION PROTOCOL (REPEATABLE)

For each roadmap item:

1) Create/adjust **skeleton** (interfaces/tables/stubs)  
2) Add **config** (env/config tables/feature flags)  
3) Implement **logic** (minimal, measurable)  
4) Add **observability** (logs/counters/errors)  
5) Add **safety** (idempotency, rate limits, permissions)  
6) Manual test in Telegram + Render logs  
7) Commit + push + deploy  
8) Update WORKFLOW.md factual notes if needed (no status markers)

For memory-related work:
9) Verify memory read/write path from actual runtime
10) Verify no raw uncontrolled chat/code is injected into prompts
11) Verify confirmed facts are separated from archive/digest
12) Verify memory restore works before repo/code work begins

---

## 4) WORKFLOW — ROADMAP ITEMS (EXPLICIT, NO RANGES)

---
