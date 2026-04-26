# STAGE 8A — RECALL ENGINE CORE (MVP, no embeddings)

- 8A.1 Date/period parser
- 8A.2 Recall by date (day window) + limit
- 8A.3 Recall by range + limit
- 8A.4 Keyword filter (ILIKE) within window
- 8A.5 Paging (/recall_more cursor)
- 8A.6 /recall [keyword] (MVP)

## 8A.7 RecallService CONTRACT

- 8A.7.1 recallByDate/Range/Keyword/paging
- 8A.7.2 strict output limits + safe truncation

## 8A.8 LOCAL RECALL SAFETY

- 8A.8.1 default local_only
- 8A.8.2 role-based depth limits
- 8A.8.3 no uncontrolled raw output
- 8A.8.4 no false recall when query is future-oriented
- 8A.8.5 show uncertainty when memory is incomplete

## 8A.9 CROSS-CHAT RECALL (groups as sources) — later consumer, not memory core

- 8A.9.1 scope: local_only / include_groups
- 8A.9.2 groups candidates only source_enabled=true
- 8A.9.3 privacy filter via Stage 11
- 8A.9.4 default local_only

## 8A.10 ANON OUTPUT (cards, not messages) — for cross-group recall

- 8A.10.1 {group_alias, date, topic, summary, confidence}
- 8A.10.2 no quotes, no identifiers
- 8A.10.3 length limits + safe truncate

## 8A.11 Monarch-first UX

- 8A.11.1 /recall default local_only
- 8A.11.2 /recall --groups monarch-only initially
- 8A.11.3 /recall_more respects scope + cursor

### Notes (factual)

- False-recall guard for future single-day phrases was corrected.
- Parsed future hints such as `tomorrow`, `day_after_tomorrow`, and `*_days_from_now` must not trigger `В памяти нет данных за этот период.`
- Historical recall guard still applies when parsed date exists but recall context is too weak.

**Gate:** Local recall is memory core. Cross-group recall is still forbidden until Stage 11.17 and 7B.10 exist.

---

# STAGE 8B — ALREADY-SEEN DETECTOR (FREE-TIER)

- 8B.1 ExtractQuery (3–7 keywords, normalized)
- 8B.2 FastLookup (chat_messages keyword + hash)
- 8B.3 Confidence rule
- 8B.4 Cooldown (e.g., 10 min)
- 8B.5 Output format (1–2 lines with date)
- 8B.6 Role-based depth (config)

## 8B.7 CROSS-GROUP HINT (anon, source alias only)

- 8B.7.1 hint line with date
- 8B.7.2 separate cooldown (30–60 min)
- 8B.7.3 high-confidence only

---

# STAGE 9 — ANSWER MODES

- 9.1 short/normal/long
- 9.2 Adaptation Layer
- 9.3 systemPrompt by mode
- 9.4 integrated in callAI
- 9.5 /mode command
- 9.6 BehaviorCore V1 (foundation)
- 9.7 Style Axis skeleton: tech/humanitarian/mixed
- 9.8 Soft style ask skeleton
- 9.9 Criticality levels V1 skeleton
- 9.10 No-Nodding rule (hard)

### Notes (factual)

- Short contextual reactions after a substantive assistant reply should not automatically trigger a generic clarification question.
- Examples of protected reaction-like messages: `Да)`, `Ок`, `Хороший план )`.
- Contextual reaction handling is separated from structurally-underspecified request handling.

**Gate:** AnswerMode must never change personality; BehaviorCore controls behavior, not length.

---

# STAGE 10 — SOURCES LAYER

- 10.1 sources table
- 10.2 ensureDefaultSources
- 10.3 fetchFromSourceKey
- 10.4 HTML
- 10.5 RSS
- 10.6 CoinGecko simple price
- 10.7 /sources /source
  - 10.7.3 /test_source
- 10.8 source_checks
- 10.9 diagnoseSource
- 10.10 /diag_source
- 10.11 runSourceDiagnosticsOnce
- 10.12 Source-permissions
- 10.13 Source-rate-limits
- 10.14 Source-logs

## (SKELETON) 10.15 SOURCE CACHE (cache-first)

- 10.15.1 source_cache (key, payload, fetched_at, ttl_sec)
- 10.15.2 hit/miss metrics → Stage 5
- 10.15.3 default no cron (on-demand + TTL)

## (SKELETON) 10.16 GROUPS AS SOURCES (unify with Sources)

- 10.16.1 source_type=telegram_group_history (key=tg_group:)
- 10.16.2 resolve alias via chat_meta
- 10.16.3 access via Stage 11 policy

## 10.17 BINANCE SOURCE POLICY (HARD)

- 10.17.1 Binance is the primary advanced trading source
- 10.17.2 CoinGecko remains base/fallback market source
- 10.17.3 Advanced TA must not rely on CoinGecko-only arrays
- 10.17.4 Spot and Futures data must be normalized separately
- 10.17.5 robot-layer computes, AI-layer explains
- 10.17.6 rate-limit strategy is mandatory before broad Binance expansion

---

# STAGE 10C — COINGECKO MODULE (V1)

- 10C.1 module skeleton
- 10C.2 V1 base data
- 10C.3 /price /prices
- 10C.4 integrations
- 10C.5 historical data
- 10C.6 indicators
- 10C.7 TA module
- 10C.8 news
- 10C.9 multi-monitor
- 10C.10 diagnostics
- 10C.11 CG V-Fuse
- 10C.12 API key

# STAGE 10D — BINANCE MARKET MODULE (PRIMARY TRADING SOURCE)

- 10D.1 Binance module skeleton
- 10D.2 Binance Spot candles source (klines / uiKlines)
- 10D.3 Binance market structure layer
- 10D.4 Binance depth source
- 10D.5 Binance trade flow source
- 10D.6 Binance derivatives source
- 10D.7 Binance normalization layer
- 10D.8 Binance rate-limit policy
- 10D.9 Binance diagnostics
- 10D.10 Market fusion with CoinGecko fallback

## Gate rules

- Binance implementation starts with candles only
- Depth is forbidden until candles + structure are stable
- Derivatives are forbidden until Spot normalization exists
- Fusion is forbidden until individual sources are verified separately
- AI must not consume raw Binance payload directly

### Notes (factual)

- 2026-03-19: Binance module skeleton was tested through `/bn_ticker` and `/bn_ticker_full`.
- Current environment returns `HTTP 451` with restricted-location response from Binance public API.
- Binance expansion is paused until provider/region accessibility changes.

---

# STAGE 10D-alt — OKX MARKET MODULE (ALTERNATIVE PUBLIC SOURCE)

- 10D-alt.1 OKX module skeleton
- 10D-alt.2 OKX public ticker source
- 10D-alt.3 OKX candles source
- 10D-alt.4 OKX snapshot layer
- 10D-alt.5 OKX diagnostics
- 10D-alt.6 OKX market fusion with CoinGecko / other fallback sources

## Gate rules

- OKX implementation starts with public ticker / candles only
- Snapshot is forbidden until ticker/candles are verified separately
- Fusion is forbidden until individual OKX sources are verified separately
- AI must not consume raw OKX payload directly

### Notes (factual)

- 2026-03-19: OKX public ticker skeleton was verified through `/okx_ticker`.
- Current environment can access OKX public market endpoint successfully.
- OKX is the active alternative market source while Binance remains paused in this environment.

---

# STAGE 11 — ACCESS MODULE (EXPANDED)

- 11.1 user identification
- 11.2 roles guest/monarch
- 11.3 monarch gate
- 11.4 protect critical commands
- 11.5 /users_stats
- 11.6 citizen role
- 11.7 vip role
- 11.8 permissions-layer can(user, action)
- 11.9 access rules for sources
- 11.10 access rules for tasks

## Access Request system V1 (11.11)

- 11.11 Access Request system (V1)
  - 11.11.1 accessRequests.js
  - 11.11.2 UX/payment pause
  - 11.11.3 /approve
  - 11.11.4 /deny
  - 11.11.5 access_requests table + auto-create
  - 11.11.6 confirmed guest trigger

## (SKELETON) 11.12 Editable access (GRANTS)

- 11.12.1 grants skeleton
- 11.12.2 integrate into can()
- 11.12.3 /grant /revoke /grants
- 11.12.4 hard ban: project/admin grants
- 11.12.5 audit/logs

- 11.13 access rules for /recall (role limits)
- 11.14 rate-limit for /recall
- 11.15 access rules for Already-Seen

## (SKELETON) 11.16 AUDIT EVENTS

- 11.16.1 audit_events: who/what/when changed
- 11.16.2 alert monarch on critical changes

## (mandatory) 11.17 GROUP SOURCE POLICIES (privacy gate)

- 11.17.1 visibility rules by role
- 11.17.2 ban author identity output
- 11.17.3 ban quotes

## (monarch-only) 11.18 Admin commands for group-sources

- 11.18.1 /group_source_on
- 11.18.2 /group_source_off
- 11.18.3 /group_sources list

## (mandatory) 11.19 AUDIT for cross-group recall

- 11.19.1 audit: CROSS_GROUP_RECALL
- 11.19.2 audit: GROUP_SOURCE_POLICY_CHANGE

---

# STAGE 11F — FILE-INTAKE SKELETON (SPECIALIZED AI GATE)

- 11F.1 download file
- 11F.2 detect type
- 11F.3 process file (routing + stub)
- 11F.4 OCR img (VISION skeleton: extract only, no analysis)
- 11F.5 PDF parse
- 11F.6 DOCX parse
- 11F.7 Audio transcript (STT skeleton)
- 11F.8 integration
- 11F.9 effectiveUserText
- 11F.10 logs
  - 11F.10.1 soft-UX without Vision (text fallback mandatory)
- 11F.11 DATA LIFECYCLE skeleton (meta/links only + retention hooks)
- 11F.12 AI routing rule: file-type → specialized AI only

---

# STAGE 12A — CAPABILITY EXTENSIONS (SPECIALIZED AI ROLES)

- 12A.1 Diagram / Chart capability
- 12A.2 Document generation capability
- 12A.3 Code/Repo analysis capability (CODE-AI skeleton)
  - 12A.3.1 Code-AI = analysis + diff only (no deploy)
  - 12A.3.2 Code-AI output = suggestions, not actions
- 12A.4 Automation/Webhook capability
- 12A.5 Capability registry

## 12A.6 CAPABILITY STATUS REGISTRY

- 12A.6.1 CapabilityStatusCollector skeleton
- 12A.6.2 collect commands from dispatcher/private command lists
- 12A.6.3 collect connected handlers and modules from repo/code facts
- 12A.6.4 infer capability status from implementation facts:
  - skeleton
  - diagnostic
  - partial
  - active
  - blocked
  - internal_only
- 12A.6.5 map capabilities to audience:
  - monarch
  - admin
  - guest
  - citizen
  - developer
  - business_user
- 12A.6.6 generate user-facing benefit cards:
  - what SG can do
  - why it is useful
  - how user should ask
  - current limits
  - access requirements
- 12A.6.7 diagnostic command: /capability_status_selftest
- 12A.6.8 future user commands:
  - /what_can_you_do
  - /how_can_you_help_me
- 12A.6.9 capability status must be derived from repo/code/runtime facts, not manual notes
- 12A.6.10 project_memory may store generated snapshots only
- 12A.6.11 generated capability snapshots must not override repo/code/runtime facts

## (SKELETON) 12A.0 REPOSITORY INDEXING (READ-ONLY FOUNDATION)

- 12A.0.1 GitHub access (fine-grained, read-only)
- 12A.0.2 RepoSource (list + fetch files)
- 12A.0.3 RepoIndexService (orchestration)
- 12A.0.4 textFilters (deny secrets / noise)
- 12A.0.5 RepoIndexSnapshot (normalized snapshot)
- 12A.0.6 Pillars indexing (pillars/*.md)
- 12A.0.7 MemoryPolicy (policy-only, no writes)
- 12A.0.8 /reindex dry-run diagnostics
- 12A.0.9 memoryCandidates preview (NO persistence)
- 12A.0.10 /code_output_status (reports ENV: CODE_OUTPUT_MODE = DISABLED|DRY_RUN|ENABLED)

Notes:
- Read-only only
- No memory writes
- No AI reasoning
- Used as foundation for future Code/Repo Analysis capability
- Gate: /code_output_status exposes current ENV mode.
- This remains here because it is repo indexing and memory-candidate preview, not Project Memory Core.

Code Output V0 allowed under strict monarch-only + manual-apply policy.

---

# STAGE 12 — FILE-INTAKE V2 (SPECIALIZED AI REALIZATION)

- 12.1 OCR vision (provider-agnostic)
- 12.2 keyframe OCR (video)
- 12.3 UI
- 12.4 PDF parser
- 12.5 DOCX/TXT/RTF
- 12.6 structuring
- 12.7 STT (speech→text only)
- 12.8 emotion
- 12.9 voice notes (STT + store, no reasoning)
- 12.10 audio extraction
- 12.11 vision analysis (fact extraction only)
- 12.12 tags
- 12.13 vision→structured JSON (no free text)

---

## Stage-check profiles skeleton (factual notes)

- A non-runtime skeleton for future universal stage-check profiles was added under `src/core/stageCheck/real/profileSkeleton/`.
- Current skeleton includes:
  - `README.md`
  - `profileFamilies.js`
  - `profileContracts.js`
  - `defaultProfiles.js`
  - `profileResolverDraft.js`
  - `profileMigrationPlan.md`
- This skeleton is intentionally NOT connected to runtime evaluator/collector yet.
- Current stable runtime checkpoint remains:
  - Stage 2 → real PARTIAL
  - Stage 5 → real OPEN
  - Stage 14A → real OPEN
- Universalization must continue in shadow/diagnostics mode first, without replacing current runtime rules.
