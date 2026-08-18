# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH WORKFLOW

## Purpose

Define the implementation and verification sequence for HS1–HS6 as an additive Memory 2.0 extension without changing approved SG identity, authority, privacy or AI-routing boundaries.

## Global execution rule

Every HS block follows the SG development procedure:

```text
audit existing implementation
-> define contracts
-> reuse existing seams
-> minimal additive implementation
-> persistence/migration only if required
-> unit/integration tests
-> security/privacy regression
-> observability/cost verification
-> exact-head CI
-> deployment when runtime behavior changes
-> live acceptance when required
-> evidence/status synchronization
```

No HS block is complete because documentation or isolated code exists.

## Reuse-first invariant

Before adding code, verify whether the capability already exists in:

- Memory 2.0;
- Conversation History;
- Temporal Service;
- Project Memory 3.0;
- PDK4;
- Decision / Incident memory;
- response-context assembly.

Do not create a competing memory database, RecallEngine, identity layer, permission layer or direct AI path.

---

## HS1 workflow — Historical Query Planner

1. Audit current semantic interpreter inputs for memory/history queries.
2. Define a structured historical query contract with topic, temporal expression, operation, source hints and scope constraints.
3. Reuse the existing Temporal Service for human-time resolution.
4. Extend semantic interpretation to operations `search`, `summarize-range`, `first-occurrence`, `last-occurrence`, `timeline`, `fact-history`.
5. Keep routing semantic rather than phrase-table based.
6. Implement ambiguity confidence/fail-closed clarification.
7. Add multilingual/paraphrase tests for supported languages.
8. Verify no internal memory/message IDs are required from the user.

Exit gate: natural historical requests reliably become one bounded structured plan without changing authorization.

Status: **IMPLEMENTED / CI-VERIFIED / NOT CLOSED**; final closure remains gated by HS6 live acceptance.

---

## HS2 workflow — Memory 2.0 Hybrid Semantic Retrieval

1. Audit current Memory 2.0 `recall()` lexical/token ranking and existing M5 contracts.
2. Preserve authorization/scope filtering as the first retrieval stage.
3. Define normalized candidate scoring inputs.
4. Keep deterministic exact/key/entity/lexical signals.
5. Add semantic relevance through existing AI Router or approved retrieval infrastructure.
6. Combine semantic relevance with trust, confirmation, confidence, lifecycle, temporal fit and scope specificity.
7. Add bounded candidate/evidence/character budgets.
8. Add deterministic fallback when AI semantic ranking is unavailable.
9. Verify all AI calls preserve provider/model/reason/cost/trace observability.
10. Run user/group/thread/project isolation regressions.

Exit gate: semantically equivalent questions can find authorized Memory 2.0 facts without exact-word dependence and without weakening privacy or boundedness.

Implementation evidence:

- canonical entry is still `createMemory2Service().recall()`;
- core authorization and deterministic ranking are preserved in `src/memory2/memory2Core.js`;
- semantic reranking is implemented in `src/memory2/hybridSemanticRecall.js` over at most 100 already-authorized candidates;
- semantic calls use SG AI Router only with reason `memory2-hybrid-semantic-retrieval`;
- exact/lexical boosts are retained; confidence/provenance/lifecycle evidence is added to the combined score;
- invalid AI output and AI Router failure return the deterministic core recall result;
- `tests/memory2HybridSemanticRetrieval.test.js` covers semantic paraphrase, authorization-before-AI, exact boost preservation and fallback;
- implementation commit `c8a073a7b65a23aa0601c093d3d81099076112a0` passed SG 2.1 CI #8479 on exact commit.

Status: **IMPLEMENTED / CI-VERIFIED / NOT CLOSED**; final closure remains gated by HS6 consolidated security/live acceptance.

---

## HS3 workflow — Unified Historical Search Orchestrator

1. Define a common normalized result contract for all historical sources.
2. Implement source selection from the HS1 plan.
3. Reuse Conversation History semantic retrieval directly for dialogue archive queries.
4. Reuse Memory 2.0 hybrid recall for personal/shared facts.
5. Reuse PM3/PDK4 integrations for project-development questions.
6. Connect Decision / Incident retrieval only through existing canonical seams.
7. Query only selected authorized sources.
8. Preserve source-local errors/omissions instead of inventing empty success.
9. Add tests for personal, group, project and mixed-source questions.
10. Verify source selection cannot broaden scope.

Exit gate: one historical request can safely combine the required canonical memory sources through one orchestration path.

Implementation evidence:

- one transport-independent orchestration entry: `createUnifiedHistoricalSearchOrchestrator().search()`;
- plan identity/project/group/thread scope is compared to resolved request scope before any retrieval; mismatch fails closed;
- no source hints defaults only to personal Conversation History + User Memory;
- Conversation History, Memory 2.0, PM3, PDK4 and Decision / Incident paths reuse existing canonical seams;
- Memory 2.0 layer selection remains resource-bound, including explicit omission when group/thread scope is absent;
- source output is normalized and bounded with explicit `ok`, `empty`, `failed`, `omitted` states;
- incident results retain advisory-only / live-verification semantics;
- source-local HS3 results remain present after HS4 merge for diagnostics/evidence inspection;
- `tests/unifiedHistoricalSearchOrchestrator.test.js` covers personal, group/thread, project-development, mixed failure, temporal-range, scope-broadening and incident cases;
- implementation HEAD `709cc33cfd898a4eaa660a90ecff69307940b986` passed SG 2.1 CI #8485 on exact HEAD.

Status: **IMPLEMENTED / CI-VERIFIED / NOT CLOSED**; final closure remains gated by HS6 consolidated security/live acceptance.

---

## HS4 workflow — Unified Ranking, Deduplication, Conflict & Supersession

1. Normalize relevance, timestamp, provenance, trust/confidence and lifecycle fields.
2. Define deterministic merge ordering/tie-break rules.
3. Merge duplicate representations of the same supported event/fact.
4. Preserve source references from all merged representations.
5. Detect contradictions across comparable current/historical records without inventing semantic conflict between unrelated records.
6. Resolve/represent supersession chains from existing Memory 2.0 / PM3 lifecycle links without deleting historical states.
7. Distinguish “true/reported then” from “current now”.
8. Add current-state versus historical-state query tests.
9. Add duplicate/message/digest merge tests and false-dedup guards.
10. Verify ranking cannot override authorization and makes no independent retrieval/model call.

Exit gate: SG returns a compact evidence-preserving result set without repeated duplicates or silent conflict flattening.

Implementation evidence:

- deterministic merger: `mergeHistoricalSearchResults()` in `src/history/unifiedHistoricalResultMerger.js`;
- canonical orchestrator integrates HS4 after selected HS3 source retrieval and returns both `sources` and `merged`;
- merge input is bounded and includes only already-authorized normalized evidence;
- ranking factors: source-local relevance, temporal fit, entity fit, scope specificity, trust, confirmation, confidence, provenance quality and lifecycle/currentness;
- current-state queries favor active/current evidence; explicit historical ranges keep superseded evidence eligible;
- duplicate suppression is evidence-backed and retains all suppressed references in `duplicateEvidence`;
- identical text for different explicit entities is not considered sufficient duplicate evidence;
- unresolved current contradictions remain explicit conflicts; no winner is fabricated and PM3 owner-authority conflict resolution remains canonical;
- `supersededBy` / `successorMemoryId` links are preserved as explicit supersession chains;
- failed/omitted source results remain explicit and still make the overall request `partial`;
- HS4 uses no AI/model call and does not add any authorization/retrieval path;
- `tests/unifiedHistoricalResultMerger.test.js` covers duplicate suppression, provenance retention, conflicts, supersession, current-state preference, false-dedup protection and partial-source integration;
- implementation HEAD `7712e2822f7cf7b658cea906ca0ba4a86b4b9a2b` passed SG 2.1 CI #8501 on exact HEAD; migrations, security gate, `npm run check`, web start, worker start and diagnostics all passed.

Status: **IMPLEMENTED / CI-VERIFIED / NOT CLOSED**; final closure remains gated by HS6 consolidated security/live acceptance.

---

## HS5 workflow — Timeline, First/Last Occurrence & Fact History

1. Extend Conversation History operation support where needed for last occurrence/timeline.
2. Define timeline event contract with evidence timestamps and source references.
3. Build timelines from normalized source events ordered by actual timestamps.
4. Implement first/last occurrence verification against original source evidence.
5. Implement durable fact-history reconstruction from provenance/lifecycle/supersession chains.
6. Add topic-history grouping across multiple episodes.
7. Add event-relative temporal resolution only after resolving the anchor event from evidence.
8. Keep human-facing output free of internal IDs/scores by default.
9. Add tests for monthly/yearly grouping and empty periods.
10. Verify model text cannot invent unsupported timeline events.

Exit gate: SG can answer “when first/last”, “how it changed” and “show history” with chronological source-verified evidence.

---

## HS6 workflow — Security, Regression, Observability & Live Acceptance

1. Run the complete HS1–HS5 regression suite.
2. Run Memory 2.0 M1–M9 regression unchanged.
3. Run Conversation History large-range pagination/hierarchical tests.
4. Run PostgreSQL restart/continuity tests.
5. Run adversarial cross-user/group/thread/project leakage tests.
6. Verify authorization occurs before any AI semantic processing.
7. Verify no raw secrets/private memory content enters telemetry.
8. Verify AI Router cost/reason/provider/model/trace accounting.
9. Run repository-wide audit for bypass/duplicate historical retrieval paths.
10. Run `npm run check`, web-start, worker-start and applicable diagnostics.
11. Require exact-head SG 2.1 CI SUCCESS.
12. Deploy and run Telegram live acceptance examples from the program document.
13. Run two-user/group isolation acceptance.
14. Record evidence and update CURRENT_STATUS only after actual proof.

Exit gate: HS1–HS6 can close only after code, exact-head CI and required live runtime evidence prove safe historical semantic memory end to end.

## Mandatory invariants

- M1–M9 remain the canonical Memory 2.0 foundation and are not duplicated.
- `global_user_id` remains the personal memory root.
- authorization and privacy filters precede semantic processing.
- old/superseded memory is visible only when an authorized historical query requires it.
- raw conversation is evidence/history, not automatically confirmed truth.
- Project Memory / PDK4 remain separate specialized layers and are accessed through canonical integrations.
- AI calls go through AI Router only.
- historical search is bounded even when the retained range spans years.
- no result may grant roles, permissions, identity, ownership or resource authority.

Architecture: `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`.
Roadmap: `../roadmap/HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`.
