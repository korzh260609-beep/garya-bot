# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH PROGRAM

## Status

**PLANNED / NOT CLOSED.** This is an additive Memory 2.0 extension. M1–M9 remain CLOSED and must not be reopened or replaced.

## Goal

Complete SG historical memory so an authorized user can ask naturally about conversations, facts, decisions, incidents and project-development topics across days, months or years by meaning, time, topic and scope without knowing exact wording or internal IDs.

## Reuse-first rule

Do not create a second memory subsystem, second RecallEngine, second scheduler/worker, second identity model or duplicate stores.

Required reuse:

- Memory 2.0;
- durable Conversation History;
- existing hierarchical AI-backed history retrieval;
- Temporal Service;
- Project Memory 3.0;
- Project Development Knowledge 4.0;
- Decision / Incident memory through canonical retrieval seams;
- bounded response context;
- Identity / Scope / Resource Authority / permissions;
- AI Router / observability / cost accounting.

## Program order

```text
HS1 Historical Query Planner
-> HS2 Memory 2.0 Hybrid Semantic Retrieval
-> HS3 Unified Historical Search Orchestrator
-> HS4 Ranking / Dedup / Conflict / Supersession
-> HS5 Timeline / First / Last / Fact History
-> HS6 Security / Regression / Observability / Live Acceptance
```

---

# HS1 — Historical Query Planner

## Goal

Convert free-form historical questions into a bounded structured search plan.

## Required scope

- semantic subject/topic extraction;
- temporal expression/range extraction;
- operation selection;
- scope/source selection hints;
- ambiguity handling;
- no phrase-table routing.

## Canonical operations

- `search`;
- `summarize-range`;
- `first-occurrence`;
- `last-occurrence`;
- `timeline`;
- `fact-history`.

## Acceptance criteria

- [ ] “Что мы обсуждали месяц назад про машину?” resolves topic + relative time + search;
- [ ] “Когда я впервые говорил про Haldex?” resolves first-occurrence;
- [ ] “Покажи как менялось решение по памяти СГ за год” resolves timeline + range;
- [ ] unsupported/ambiguous intent fails closed to a concise clarification;
- [ ] no internal IDs are required from the user;
- [ ] interpretation is transport-independent.

---

# HS2 — Memory 2.0 Hybrid Semantic Retrieval

## Goal

Upgrade Memory 2.0 from primarily lexical/token recall to hybrid semantic retrieval while preserving policy-first deterministic filtering.

## Required scope

- exact key/entity/topic boosts;
- lexical relevance;
- semantic relevance through approved AI Router/retrieval infrastructure;
- trust/confirmation/confidence weighting;
- lifecycle/temporal fit;
- scope specificity;
- bounded candidate/evidence limits;
- cost logging.

## Acceptance criteria

- [ ] semantically equivalent wording finds the same authorized fact without exact token overlap;
- [ ] authorization occurs before semantic content reaches AI;
- [ ] superseded/expired facts remain excluded from ordinary recall but available in authorized historical mode;
- [ ] AI failure has a bounded deterministic fallback;
- [ ] no direct model calls bypass AI Router;
- [ ] user/group/thread/project isolation regression remains green.

---

# HS3 — Unified Historical Search Orchestrator

## Goal

Select and query only the relevant canonical memory/history sources for one user request.

## Candidate sources

- Conversation History;
- User Memory;
- User × Group Memory;
- Group / Thread Memory;
- Topic Digest;
- Project Memory 3.0;
- PDK4;
- Decision / Incident memory where applicable.

## Acceptance criteria

- [ ] personal questions do not query unrelated shared/project stores by default;
- [ ] project-development questions can combine Conversation History + PM3 + PDK4;
- [ ] group/thread questions remain resource-bound;
- [ ] source selection never broadens authorization;
- [ ] one request returns normalized source results through one orchestration contract;
- [ ] every source failure is explicit and cannot be converted into invented evidence.

---

# HS4 — Unified Ranking, Deduplication, Conflict & Supersession

## Goal

Merge heterogeneous results into one evidence-preserving historical answer set.

## Ranking factors

- semantic relevance;
- temporal match;
- exact entity/key match;
- scope specificity;
- trust;
- confirmation;
- confidence;
- provenance quality;
- lifecycle/currentness where relevant.

## Acceptance criteria

- [ ] duplicate representations from message + memory + digest do not appear as repeated user results;
- [ ] conflicting facts remain visible as conflicts;
- [ ] supersession chains distinguish past truth-state from current state;
- [ ] historical queries may return superseded evidence when it was valid/reported in the requested period;
- [ ] current-state queries prefer current supported values;
- [ ] merge retains source references for verification.

---

# HS5 — Timeline, First/Last Occurrence & Fact History

## Goal

Provide chronological and provenance-aware historical reasoning over stored evidence.

## Required scope

- timeline construction;
- first occurrence;
- last occurrence;
- first confirmed fact;
- latest supported update;
- fact lifecycle history;
- topic history;
- event-relative time where evidence can resolve the anchor event.

## Acceptance criteria

- [ ] “когда впервые” returns earliest source-verified occurrence;
- [ ] “когда последний раз” returns latest supported occurrence;
- [ ] “как менялось” returns chronological evidence-backed evolution;
- [ ] timeline never invents events for empty periods;
- [ ] fact history exposes provenance/trust/confirmation/supersession state internally;
- [ ] user-facing output stays human-readable and does not expose IDs/scores by default.

---

# HS6 — Security, Regression, Observability & Live Acceptance

## Goal

Close the extension only after end-to-end safety, durability and Telegram acceptance are proven.

## Mandatory regression matrix

- [ ] historical search one year back;
- [ ] semantic paraphrase without exact words;
- [ ] exact month/range;
- [ ] approximate relative time;
- [ ] first occurrence;
- [ ] last occurrence;
- [ ] timeline;
- [ ] fact supersession/history;
- [ ] cross-source merge;
- [ ] duplicate suppression;
- [ ] ambiguity clarification;
- [ ] AI failure fallback;
- [ ] large archive hierarchical retrieval;
- [ ] restart continuity;
- [ ] user isolation;
- [ ] group isolation;
- [ ] thread isolation;
- [ ] project isolation;
- [ ] unauthorized memory never reaches semantic processing;
- [ ] no secrets/raw private content in telemetry;
- [ ] AI Router provider/model/reason/cost/trace logging remains complete.

## Live acceptance examples

After deployment, Telegram acceptance must include natural requests equivalent to:

- “Что я говорил месяц назад?”
- “Найди нашу тему про мои машины.”
- “Когда впервые я говорил про Freelander?”
- “Что мы обсуждали прошлым летом?”
- “Покажи развитие памяти СГ по месяцам.”
- “Как изменялось решение по автоматизации?”

A two-user/group test must verify that unauthorized memory never crosses identity or workspace boundaries.

## Completion definition

HS1–HS6 are CLOSED only when implementation, exact-head CI and required live acceptance prove the complete historical semantic path. Documentation alone never closes a block.

Architecture: `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`.
Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`.
Memory foundation: `MEMORY_2_0_ROADMAP.md`.
