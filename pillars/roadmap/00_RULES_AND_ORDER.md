# ROADMAP — RULES AND ORDER

> Active roadmap source for SG project evolution.  
> Purpose: define allowed development order without premature feature jumps.

This roadmap must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/README.md`
- `pillars/workflow/README.md`

Important:
- `pillars/DECISIONS.md` is the single root decisions file.
- `pillars/DECISIONS.md` is the upper philosophical and architectural foundation for SG.
- Roadmap defines implementation order, not SG philosophy.
- If roadmap conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` wins.

---

## 0) ACTIVE ROADMAP RULES

- The active roadmap is split under `pillars/roadmap/`.
- Old `pillars/ROADMAP.md` is legacy/inactive when split roadmap files exist.
- Status markers are intentionally not used.
- Order and structure define the development sequence.
- Actual completion must be verified from repository/runtime, not from labels.
- Roadmap files must remain aligned with the active split workflow.

---

## 0.1 SG ENTITY / COMPONENT ALIGNMENT

SG is the global project entity and global intellectual system.

Roadmap planning must preserve this model:

```text
SG = global project entity / global intellectual system
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
minimal controller/gate = action protection layer, not SG brain
```

Hard rules:
- A component may support SG, but must not replace SG.
- External AI operators may help analyze or generate suggestions, but they do not own SG decisions, identity, memory, or project experience.
- SG project experience must remain preserved through pillars, decisions, architecture, code, memory, verified repo state, snapshots and recoverable history.
- Any roadmap item that would make a component act as a separate SG is architecturally invalid.
- Any roadmap item that would turn a router/controller/AI wrapper into SG brain is architecturally invalid.

---

## 0.2 MINIMAL CONTROLLER / CAPABILITY ACCESS GATES

Roadmap planning must preserve:

```text
Reasoning model / meaning provider understands meaning.
Minimal controller/gate protects actions, permissions, scope, sources, risks, costs and confirmations.
Heavy SemanticRouter as a separate SG brain is not the goal.
Capability access != authority to redefine SG.
```

Hard rules:
- Do not connect Human Mode runtime without explicit gate.
- Do not build a heavy router that replaces reasoning model intelligence.
- Do not treat controller/gate as a separate SG brain.
- Do not convert old phrase/keyword/regex routes into Human Mode intelligence.
- Do not treat Technical Mode legacy routes as SG’s normal intelligence layer.
- Do not bypass permissions, source checks, risk checks, cost checks or confirmations for protected actions.
- Do not treat capability access as governance authority.

---

## 0.3 MEMORY PRIORITY CLARIFICATION

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

- GLOBAL RULE — SG reasons, advises, coordinates and prepares; user/monarch makes final decisions
- GLOBAL RULE — external AI operators are tools of SG, not SG itself
- GLOBAL RULE — specialized AI first, reasoning AI last where that saves cost and preserves quality
- GLOBAL RULE — no direct AI calls, only via router/wrapper
- GLOBAL RULE — every AI call is logged with cost + reason where supported
- GLOBAL RULE — BehaviorCore is independent from AnswerMode (length ≠ style)
- GLOBAL RULE — short/normal/long preserve the same SG personality
- GLOBAL RULE — unclear intent → max 1 soft clarifying question
- GLOBAL RULE — soft form / hard essence (risk-first, no “ты неправ”)
- GLOBAL RULE — SG is free in thinking and controlled in actions
- GLOBAL RULE — skeleton → config → logic for every new capability
- GLOBAL RULE — no architecture changes without explicit decision entry after monarch approval
- GLOBAL RULE — stage gates are strict
- GLOBAL RULE — protected actions require action-type, permission, source/scope, risk/cost and confirmation checks where applicable
- GLOBAL RULE — no heavy router/controller/AI wrapper may become SG brain

---

## 2) ROADMAP FLOW (CANONICAL ORDER)

Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Project Memory Core → Long-Term Memory Core → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

---

## 3) STAGE GATE RULE

- Stage N cannot consume implementation features from Stage N+1 without explicit accepted approval.
- Project Memory Core and Long-Term Memory Core must be reliable enough before broad new feature expansion.
- Real external integrations stay gated by their original stages.
- No feature may introduce a second SG identity or let a component/tool/agent behave as independent SG.
- No feature may connect Human Mode runtime, build a heavy router, or expose sensitive capabilities without explicit gate, permissions, source checks, risk checks and confirmations where required.

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

For entity/control-sensitive work:

1. Verify the changed component remains a component/instrument of SG
2. Verify no controller/router/AI wrapper behaves as SG brain
3. Verify Human Mode runtime remains gated unless explicitly approved
4. Verify protected actions do not bypass controller/gate, permissions, source checks, risk checks, cost checks or confirmations
