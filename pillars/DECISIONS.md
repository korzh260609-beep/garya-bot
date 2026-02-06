# DECISIONS.md — SG AI SYSTEM

This file contains FINAL, NON-NEGOTIABLE architectural and system decisions.
If code, workflow, proposals or AI behavior contradict this file — they are considered incorrect.

No drafts. No ideas. No TODOs.
Only accepted decisions.

---

## D-001: SG is the decision maker, AI is execution only
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Core / Governance

Decision:
SG defines decisions. AI executes instructions only.

Consequences:
- AI must not make architectural or policy decisions
- All decisions must be explicit and traceable

---

## D-002: No direct AI calls — router only
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Core / AI Calls

Decision:
All AI calls MUST go through a centralized router.

Consequences:
- Direct model calls are forbidden
- Missing routing or logging is a system bug

---

## D-003: Specialized AI first, reasoning AI last
Status: ACCEPTED  
Date: 2026-01-11  
Scope: AI Strategy

Decision:
Specialized AI (vision, STT, code, etc.) is used first.
Reasoning AI is used only as validator or explainer.

Consequences:
- Reasoning AI must not replace specialized AI
- Reasoning is not used for raw extraction

---

## D-004: Every AI call must be logged with cost and reason
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Observability / Billing

Decision:
Each AI call logs:
- model
- cost
- reason for usage

Consequences:
- Unlogged AI usage is forbidden
- Missing logs invalidate execution

---

## D-005: BehaviorCore is independent from AnswerMode
Status: ACCEPTED  
Date: 2026-01-11  
Scope: AI Behavior

Decision:
BehaviorCore defines personality and risk logic.
AnswerMode controls length only (short/normal/long).

Consequences:
- AnswerMode must never affect behavior
- Any coupling is a system error

---

## D-006: Answer modes preserve identical personality
Status: ACCEPTED  
Date: 2026-01-11  
Scope: AI UX

Decision:
short / normal / long differ only in length, not in tone or logic.

Consequences:
- Personality drift across modes is forbidden

---

## D-007: Unclear intent → max one soft clarifying question
Status: ACCEPTED  
Date: 2026-01-11  
Scope: AI Interaction

Decision:
If intent is unclear, SG may ask only ONE soft clarifying question.

Consequences:
- Clarification loops are forbidden
- After clarification, execution must continue

---

## D-008: Soft form, hard essence (risk-first)
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Communication Style

Decision:
Communication form is soft.
Risk and constraints are stated explicitly and first.

Consequences:
- No personal judgment (“ты неправ”)
- Risks must never be hidden

---

## D-009: Mandatory work order — skeleton → config → logic
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Development Process

Decision:
Any new capability must follow:
1) Skeleton  
2) Config  
3) Logic  

Consequences:
- Skipping steps is forbidden
- Violations require rollback

---

## D-010: No architecture changes on the fly
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Architecture Governance

Decision:
Architecture changes require explicit fixation in DECISIONS.md.

Consequences:
- Undocumented changes are invalid
- DECISIONS.md is a mandatory gate

---

## D-011: Stage gates are strict and non-bypassable
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Roadmap Enforcement

Decision:
Stage N must not consume features from Stage N+1.

Consequences:
- Gate violations are system bugs
- Future-stage features must be stubbed or disabled

---

## D-012: Transport layer is thin and stateless
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Transport / Multi-Channel

Decision:
Transport layer contains no memory, permissions or business logic.

Consequences:
- Core is channel-agnostic
- Transport is adapter-only

---

## D-013: Global identity over platform identity
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Identity

Decision:
All roles, permissions and memory bind to global_user_id.

Consequences:
- Platform IDs are links only
- Channel switch ≠ new identity

---

## D-014: Chat History is not Memory
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Memory Architecture

Decision:
Chat History stores factual logs for recall.
Memory stores curated, semantic long-term knowledge.

Consequences:
- Raw chat dumps to AI are forbidden
- Recall operates on strict limits

---

## D-015: Privacy-first group recall
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Privacy / Recall

Decision:
Cross-group recall is anonymized:
- no quotes
- no author identity
- alias only

Consequences:
- Identity leakage is a critical bug
- Verbatim quotes are forbidden

---

## D-016: System correctness overrides AI intelligence
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Global

Decision:
System correctness, safety and predictability override AI capability.

Consequences:
- AI may be blocked by safety rules
- “Smarter but unsafe” behavior is forbidden

---

## D-017: SG Code-AI operates in analysis and suggestion mode only
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Code / Repository Interaction

Decision:
SG may:
- read and index the repository
- analyze code and architecture
- detect errors and violations
- provide textual suggestions only

SG must NOT:
- deploy code
- apply changes automatically
- modify production without human action
- generate patches or diffs in B3 stage

Consequences:
- Human is the final executor
- AI output is advisory only

---

## D-018: chat_memory stores decisions and results only
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Memory / Storage

Decision:
chat_memory stores only:
- decisions
- results
- conclusions
- confirmed facts

chat_memory must NOT store:
- raw dialogue
- raw source code
- speculative reasoning
- unverified ideas

Consequences:
- Storing raw chat or code is forbidden
- Memory pollution is a system error

---

## D-019: Pillars are source of truth, not chat logs
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Knowledge Hierarchy

Decision:
Pillars define system philosophy, constraints and invariants.
Chat logs do not override Pillars.

Consequences:
- Conflicts resolve in favor of Pillars
- Chat history is never authoritative

---

## D-020: RepoIndex stores structure and hashes only
Status: ACCEPTED  
Date: 2026-01-11  
Scope: Repo Indexing / Code-AI

Decision:
RepoIndex stores:
- file and folder structure
- metadata
- hashes and identifiers

RepoIndex must NOT store:
- full repository content
- raw source code bodies

Consequences:
- Full code is fetched on-demand only
- RepoIndex is structural, not archival

---

## D-021: Suggestions noise filtering and aggregation rules
Status: ACCEPTED  
Date: 2026-01-19  
Scope: Code Review / Suggestions (B3)

Decision:
Suggestions are high-level, aggregated and noise-filtered conclusions derived from detected issues.

Rules:
- One suggestion per issue type (no duplication)
- Maximum 7 suggestions total
- Heuristic-only issue types must be aggregated
- If only heuristic issues are present, severity MUST be lowered
- Suggestions must never contain code or instructions

---

## D-022: Repo Review — UNREACHABLE_CODE heuristic policy
Status: ACCEPTED  
Date: 2026-01-21  
Scope: Repo Review / Heuristics (B4)

Decision:
UNREACHABLE_CODE is heuristic and non-blocking.
Allowed zones downgrade severity:
- src/bot/handlers/*
- src/sources/*
- classifier.js

---

## D-023: Controlled Code Writing (B6)
Status: ACCEPTED  
Date: 2026-01-25  
Scope: Code Generation / Governance

Decision:
From stage B6, SG is allowed to WRITE CODE OUTPUT,
but ONLY under strict human-applied control.

Rules:
- SG writes code only by explicit command.
- SG NEVER inserts, commits, deploys or modifies files itself.
- All code is copied and applied by the human.

Mandatory output format:
1) FILE
2) ACTION (ADD_NEW_FILE | REPLACE | INSERT)
3) ANCHOR
4) CODE
5) WHY
6) RISKS
7) CHECK

Restrictions:
- No refactor without command
- No architectural changes without DECISIONS update
- No secret handling
- No silent behavior changes

Consequences:
- Any deviation is a critical governance violation
- Human remains the sole executor

---

## D-024: CODE_OUTPUT Enable Gate
Status: ACCEPTED  
Date: 2026-02-06  
Scope: Code Generation / Governance

Decision:
CODE_OUTPUT (генерация кода) **запрещён по умолчанию** и может быть включён
**только отдельным явным Decision монарха**.

Никакие команды, флаги, конфигурации, условия или логика
**не имеют права** активировать CODE_OUTPUT автоматически или косвенно.

Единственный допустимый путь включения:
- отдельная запись в DECISIONS.md;
- прямое подтверждение монарха;
- ручное принятие решения.

До этого момента CODE_OUTPUT считается
**PERMANENTLY DISABLED (skeleton only)**.

Consequences:
- Любая автоматическая или косвенная активация является критическим нарушением governance
- SG обязан блокировать и явно сообщать о любой попытке обхода gate
