# WORKFLOW.md — SG AI SYSTEM (Strict Roadmap Execution)

> Single source of truth for development order.  
> Purpose: prevent premature decisions, keep skeleton intact, make errors early + cheap.

This workflow must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`

---

## 0) LEGEND

- Статусы намеренно убраны
- Порядок и структура являются источником истины
- Факт выполнения определяется анализом репозитория и системы, а не маркерами
- Ручные отметки выполнения, галочки, done/complete/status-маркеры в pillars запрещены
- Pillars фиксируют порядок, правила, архитектурные решения и фактические примечания, но не используются как ручной чеклист
- Любой статус выполнения должен выводиться из repo/runtime/тестов или автоматического status snapshot, а не проставляться вручную

---

## 0.1 SG ENTITY / COMPONENT ALIGNMENT

SG is the global project entity.

Workflow execution must preserve this model:

```text
SG = global project entity
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
```

Human Mode, Technical Mode, RepoStateAgent, agents, tools, transports, memory, sources, diagnostics and future interfaces are components or instruments of SG.

They must not be planned, implemented, documented or tested as separate independent SG entities.

Hard rules:
- A component may support SG, but must not replace SG.
- External AI operators may help analyze or generate suggestions, but they do not own SG decisions, identity, memory, or project experience.
- SG project experience must remain preserved through pillars, decisions, architecture, code, memory, verified repo state, snapshots and recoverable history.
- Any workflow step that would make a component act as a separate SG is architecturally invalid.

---

## 0.2 SEMANTIC ROUTING / CAPABILITY ACCESS GATES

Workflow execution must preserve:

```text
Human Mode skeleton first.
Global SemanticRouter later, only after explicit accepted gate.
Capability access != authority to redefine SG.
```

Hard rules:
- Do not connect Human Mode runtime without explicit gate.
- Do not build a global SemanticRouter now.
- Do not convert old phrase/keyword/regex routes into Human Mode intelligence now.
- Do not treat Technical Mode legacy routes as SG’s normal intelligence layer.
- Do not treat capability access as governance authority.
- Do not treat code-output, diagnostics, AgentWorkspace, RepoStateAgent, or external AI tools as independent SG entities.

---

## 0.3 MEMORY ORDER CLARIFICATION

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
11. No architecture changes “on the fly”. Architecture changes require explicit revision note in DECISIONS.md or accepted decision file under `pillars/decisions/`.
12. If something is ambiguous, STOP and add a note to DECISIONS.md or accepted decision file before implementing.
13. If a step references a later stage, it is forbidden (stage gate).
14. Before continuing repository development, SG must restore current project memory context.
15. Project Memory Core and Long-Term Memory Core are early foundation, not optional future enhancements.
16. Do not manually mark pillars items as done/complete; completion evidence must come from repo/runtime verification or generated status snapshots.
17. Do not treat a mode, agent, tool, transport, source, memory layer, or repository subsystem as SG itself.
18. Do not use semantic-routing language to bypass the current Human Mode skeleton gate.
19. Do not use capability-access language to bypass permission/governance gates.

---

## 2) STAGE GATES (ROADMAPPED ORDER)

**Canonical order (must not be reordered):**  
Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Project Memory Core → Long-Term Memory Core → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

**Gate rule:** Stage N cannot consume features from Stage N+1.

Memory gate rule:
- No major new feature work should continue until Project Memory Core and Long-Term Memory Core are reliable enough for SG to restore current project state, decisions, constraints, risks, and next steps.

Entity gate rule:
- No feature may introduce a second SG identity or let a component/tool/agent behave as independent SG.

Semantic/capability gate rule:
- No feature may create Global SemanticRouter, connect Human Mode runtime, or expose sensitive capabilities without the explicit accepted gate defined in architecture/decisions.

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
8) Add factual notes only if needed; do not add manual status markers/checkmarks to pillars

For memory-related work:
9) Verify memory read/write path from actual runtime
10) Verify no raw uncontrolled chat/code is injected into prompts
11) Verify confirmed facts are separated from archive/digest
12) Verify memory restore works before repo/code work begins

For entity-sensitive work:
13) Verify the changed component remains a component/instrument of SG
14) Verify prompts/docs do not describe external AI operators as SG itself
15) Verify Human Mode / Technical Mode / RepoStateAgent remain separated according to architecture

For semantic/capability-sensitive work:
16) Verify Human Mode runtime remains gated unless explicitly approved
17) Verify Global SemanticRouter is not introduced before accepted gate
18) Verify capability access does not become governance authority

---

## 4) WORKFLOW — ROADMAP ITEMS (EXPLICIT, NO RANGES)

---
