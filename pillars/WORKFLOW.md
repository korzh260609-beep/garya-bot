# WORKFLOW.md — SG AI SYSTEM (Strict Roadmap Execution)

> Single source of truth for development order.  
> Purpose: prevent premature decisions, keep skeleton intact, make errors early + cheap.

---

## 0) LEGEND

- Статусы намеренно убраны
- Порядок и структура являются источником истины
- Факт выполнения определяется анализом репозитория и системы, а не маркерами

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

---

## 2) STAGE GATES (ROADMAPPED ORDER)

**Canonical order (must not be reordered):**  
Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

**Gate rule:** Stage N cannot consume features from Stage N+1.

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

---

## 4) WORKFLOW — ROADMAP ITEMS (EXPLICIT, NO RANGES)

---

# STAGE 1 — BASE INFRASTRUCTURE

- 1.1 Telegram-bot
- 1.2 Node.js + Express
- 1.3 Webhook + Render
- 1.4 Basic bot reply

**Allowed now:** respond to messages, basic command routing.  
**Forbidden now:** anything needing DB schema evolution / identity linking / cross-chat memory.

---

# STAGE 2 — DATABASE + TASK ENGINE V0

- 2.1 PostgreSQL
- 2.2 Tables: users / chat_memory / tasks / sources / logs / project_memory
- 2.3 Demo-task
- 2.4 Commands: /tasks /run /newtask
- 2.5 interaction_logs logging

## (SKELETON) 2.6 DB MIGRATIONS (do not break prod)

- 2.6.1 migrations framework (choose ONE: node-pg-migrate OR knex OR other)
- 2.6.2 schema_version (table/meta) + apply order
- 2.6.3 forward-only migrations (no manual SQL in prod)

## (SKELETON) 2.7 JOB QUEUE / WORKERS (no scaling now)

- 2.7.1 JobRunner interface (enqueue/run/ack/fail)
- 2.7.2 idempotency_key for runs (task_run_key)
- 2.7.3 retry policy skeleton (max_retries/backoff/jitter)
- 2.7.4 DLQ skeleton (exists but disabled)

## (SKELETON) 2.8 EXECUTION SAFETY

- 2.8.1 “exactly one run” for cron (db-lock / advisory lock)
- 2.8.2 restart dedupe (run_key + unique)

## (SKELETON) 2.9 Interaction Hygiene

- 2.9.1 no pressure / no user evaluation / no “я же говорил”

**Gate:** Do not implement real cron scaling or distributed workers until 2.8 is present.

---

# STAGE 3 — ACCESS V0 (MINIMUM GATE)

- 3.1 Identify user/chat
- 3.2 Roles: guest / monarch
- 3.3 Minimal can(user, action)
- 3.4 Ban auto-tasks and admin commands for guest
- 3.5 Rate-limit commands

## (SKELETON) 3.6 CONFIG / SECRETS HYGIENE

- 3.6.1 dev/staging/prod env mapping (strict)
- 3.6.2 secrets rotation hooks
- 3.6.3 feature flags storage (table/config, no hardcode)

**Gate:** Anything affecting safety policies must be behind can() and rate limits.

---

# STAGE 4 — MULTI-CHANNEL IDENTITY (FOUNDATION, mandatory)

- 4.1 Introduce global_user_id
- 4.2 platform_user_id stored only as links
- 4.3 user_identities/user_links table (global_user_id ↔ platform ↔ platform_user_id)
- 4.4 linking flow (code/confirm) + minimal commands/UX
- 4.5 can()/roles/plans bound to global_user_id (not platform id)
- 4.6 Hard ban: “roles/limits per platform”

**Gate:** No real multi-channel integrations until 4.4 is complete.

---

# STAGE 5 — OBSERVABILITY V1

- 5.1 task_runs
- 5.2 source_runs
- 5.3 error_events
- 5.4 retries / fail-reasons
- 5.5 /health
- 5.6 /last_errors
- 5.7 /task_status
- 5.8 chat_messages_count
- 5.9 recall_requests
- 5.10 recall_errors
- 5.11 already_seen_hits
- 5.12 already_seen_cooldown_skips
- 5.13 db_size_warning (70% / 85%)

## (SKELETON) 5.14 SCALING METRICS

- 5.14.1 queue_depth
- 5.14.2 dlq_count
- 5.14.3 webhook_dedupe_hits
- 5.14.4 lock_contention

## (SKELETON) 5.15 ADMIN ALERTS (no dashboards)

- 5.15.1 alerts to monarch: db_size_warning / repeated source failures / queue stuck

## 5.16 behavior_events (WIRED, minimal)

- 5.16.1 behavior_events table (migration 015)
- 5.16.2 risk_warning_shown (DEV-only guard hit)
- 5.16.3 rate_limited (command RL hit)
- 5.16.4 permission_denied (perm guard hit)
- 5.16.5 DEV verify command: /behavior_events_last <N> (monarch-private)

## (FUTURE) 5.16 behavior_events (next events)

- 5.16.F1 clarification_asked
- 5.16.F2 answer_mode_changed
- 5.16.F3 style_axis_used

## (FUTURE) 5.xx GROUP-SOURCES METRICS (privacy control)

- 5.xx.1 cross_group_recall_requests
- 5.xx.2 cross_group_recall_hits
- 5.xx.3 privacy_blocks
- 5.xx.4 redaction_applied_count
- 5.xx.5 top_source_groups (alias, hits) — monarch only

**Gate:** No scaling features without metrics hooks defined.

---

# STAGE 6 — TRANSPORT LAYER SKELETON

- 6.1 TransportAdapter concept
- 6.2 Unified context (user/chat/role/lang/input)
- 6.3 handleMessage(context)
- 6.4 Telegram → Adapter
- 6.5 Discord Adapter (skeleton)
- 6.6 Web / API Adapter (skeleton)
- 6.7 Email Adapter (skeleton)

 ### Notes (factual)

- 2026-02-25: финальная очистка router (удалён deriveChatMeta из router; router использует только raw msg.chat.type).
- Verified in Telegram:
  - /build_info works in private
  - /build_info blocked in groups (DEV only)
- Deployed commit: 00d8e3748864c0da1a28dadf9575937220847a4a

## (SKELETON) 6.8 MULTI-INSTANCE SAFETY

- 6.8.1 adapter→core dedupe key
- 6.8.2 no side-effects without idempotency

## FOUNDATION 6.9 MULTI-CHANNEL RULES (hard)

- 6.9.1 Core/Memory/Access unified, Transport thin
- 6.9.2 Transport must not store memory/permissions/business logic
- 6.9.3 Transport resolves global_user_id via Identity (Stage 4)
- 6.9.4 Channel switch ≠ new identity

**Gate:** Transport implementations may exist as stubs only until Stage 4 is complete.

---

# STAGE 7 — MEMORY LAYER V1

- 7.1 Write memory
- 7.2 Read memory
- 7.3 Context selection
- 7.4 Long-term memory
- 7.5 Anti-duplicates
- 7.6 ROBOT mock-monitor

## (SKELETON) 7.7 MemoryService CONTRACT

- 7.7.1 interface: write/read/context/recent
- 7.7.2 ban direct SQL from handlers

**Gate:** Any module consuming memory must call MemoryService only.

---

# STAGE 7A — PROJECT MEMORY LAYER (VOICE FOUNDATION)

- 7A.1 Project Memory structure
- 7A.2 project_memory table
- 7A.3 project-context model
- 7A.4 project auto-restore
- 7A.5 getProjectSection / upsertProjectSection
- 7A.6 Loader
- 7A.7 Commands /pm_set /pm_show
- 7A.V1 Speech→Text (STT skeleton, provider-agnostic)
- 7A.V2 Voice→AI Router (text only)
- 7A.V3 Text→Speech (TTS skeleton, notifications only)

---

# STAGE 7B — CHAT HISTORY (LONG-TERM / POINT-RECALL / FREE-TIER SAFE)

- 7B.1 chat_messages table (safe-limited full messages)
- 7B.2 Indexes
  - 7B.2.1 (chat_id, created_at DESC)
  - 7B.2.2 unique (chat_id, platform_message_id)
  - 7B.2.3 (chat_id, text_hash)
- 7B.3 Log every incoming message
- 7B.4 Log every SG output
- 7B.5 Free-tier DB growth protections
  - 7B.5.1 hard cap text size (8–16KB)
  - 7B.5.2 no binary (links/meta only)
  - 7B.5.3 truncated flag
- 7B.6 retention-policy skeleton (disabled)
  - 7B.6.1 guest_retention_days
  - 7B.6.2 citizen_retention_days
  - 7B.6.3 monarch_retention_days = unlimited
  - 7B.6.4 ARCHIVE_ENABLED=false

## (SKELETON, critical) 7B.7 IDEMPOTENCY CORE

- 7B.7.1 process-once via platform_message_id
- 7B.7.2 race-safe inserts (insert-first + unique handling)
- 7B.7.3 correct handling of Telegram/webhook retries

## FOUNDATION 7B.8 GROUPS AS SOURCES — CHAT REGISTRY META

- 7B.8.1 chat_meta table (chat_id, platform, chat_type, title, alias, created_at)
- 7B.8.2 alias required for group-source (show alias only)
- 7B.8.3 title stored as service field (not shown by default)

## 7B.9 GROUP SOURCE FLAGS

- 7B.9.1 source_enabled default=false
- 7B.9.2 privacy_level enum
- 7B.9.3 allow_quotes=false
- 7B.9.4 allow_raw_snippets=false

## (mandatory) 7B.10 REDACTION RULES

- 7B.10.1 remove @mentions / profile links
- 7B.10.2 remove phone/email/explicit identifiers
- 7B.10.3 safe-truncate snippets (400–800 chars)
- 7B.10.4 ban verbatim quotes for cross-group (no quotes)

**Gate:** No recall features until 7B exists (at least table + logging + limits).

---

# STAGE 8A — RECALL ENGINE (MVP, no embeddings)

- 8A.1 Date/period parser
- 8A.2 Recall by date (day window) + limit
- 8A.3 Recall by range + limit
- 8A.4 Keyword filter (ILIKE) within window
- 8A.5 Paging (/recall_more cursor)
- 8A.6 /recall [keyword] (MVP)

## (SKELETON) 8A.7 RecallService CONTRACT

- 8A.7.1 recallByDate/Range/Keyword/paging
- 8A.7.2 strict output limits + safe truncation

## PRIVACY-SAFE 8A.8 CROSS-CHAT RECALL (groups as sources)

- 8A.8.1 scope: local_only / include_groups
- 8A.8.2 groups candidates only source_enabled=true
- 8A.8.3 privacy filter via Stage 11
- 8A.8.4 default local_only

## ANON OUTPUT 8A.9 (cards, not messages)

- 8A.9.1 {group_alias, date, topic, summary, confidence}
- 8A.9.2 no quotes, no identifiers
- 8A.9.3 length limits + safe truncate

## Monarch-first UX 8A.10

- 8A.10.1 /recall default local_only
- 8A.10.2 /recall --groups monarch-only initially
- 8A.10.3 /recall_more respects scope + cursor

**Gate:** Cross-group recall forbidden until Stage 11.17 and 7B.10 exist.

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

---

# STAGE 10C — COINGECKO MODULE (V1)

- 10C.1 module skeleton
- 10C.2 V1 base data
- 10C.3 /price /prices
- 10C.4 integrations

10C.PAUSE — Free-tier IP rate-limit (Render NAT), cache-first needed

- 10C.5 historical data
- 10C.6 indicators
- 10C.7 TA module
- 10C.8 news
- 10C.9 multi-monitor
- 10C.10 diagnostics
- 10C.11 CG V-Fuse
- 10C.12 API key

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

# STAGE 13 — V8 INITIATIVE

- 13.1 improvements
- 13.2 find weak points
- 13.3 architecture audit
- 13.4 UX audit
- 13.5 module improvements

## 13.6 comfort-by-default skeleton

- 13.6.1 pressure detection
- 13.6.2 over-philosophy detection
- 13.6.3 loss-of-focus detection

---

# STAGE 14 — V9 PR / DIFF (CODE-AI USAGE)

- 14.1 PR generation (proposal only)
- 14.2 auto-diff (read-only)
- 14.3 explanations
- 14.4 suggestions
- 14.5 Human approval mandatory (hard)

---

# STAGE 14A — REAL INTEGRATIONS

- 14A.1 Discord implementation
- 14A.2 Web UI / API
- 14A.3 GitHub / Repo integration
- 14A.4 Diagram engines
- 14A.5 Zoom / Voice integration

## 14A.6 MULTI-CHANNEL REQUIREMENT (hard)

- 14A.6.1 Discord only after Stage 4 linking foundation
- 14A.6.2 all channels must resolve global_user_id and share memory
- 14A.6.3 ban separate “Discord memory” / separate Discord limits
- 14A.6.4 Discord continues Telegram context (same global_user_id)

---

# STAGE 15 — V10 MULTI-MODEL (SPECIALIZED AWARE)

- 15.1 text models registry
- 15.2 specialized models registry (vision/stt/tts/code)
- 15.3 AI Router V1 (task-type based)
- 15.4 modality detection (text/vision/speech/code)
- 15.5 fallback policy (spec-AI unavailable → text-only)
- 15.6 cost tier tagging per model

---

# STAGE 16 — V11 MULTI-MODEL++ (SMART ROUTING)

- 16.1 automatic modality routing
- 16.2 cheap-first policy (default)
- 16.3 reasoning-AI only by explicit need
- 16.4 parallel spec-AI allowed (vision + stt)
- 16.5 AI usage explanation log (why this model)

---

# STAGE 17 — V12 HYBRID INTELLIGENCE

- 17.1 hybrid execution (robot + spec-AI + reasoning)
- 17.2 spec-AI before reasoning-AI (hard)
- 17.3 reasoning as validator, not extractor
- 17.4 auto-orchestrator with safety caps
- 17.5 AI-budget governor (per user/per role)

---

# STAGE 18 — LEGAL & BILLING (AI COST VISIBILITY)

- 18.1 tariffs & plans
- 18.2 AI-credits per AI-type
- 18.3 cost transparency per task
- 18.4 logs dashboard
- 18.5 memory dashboard
- 18.6 license
- 18.7 privacy
- 18.8 model-level audit (who called what/why)

## (SKELETON) 18.9 DATA RETENTION & EXPORT

- 18.9.1 export user data
- 18.9.2 delete/anonymize hooks

---

# STAGE 19 — RISK & MARKET PROTECTION

- 19.1 architecture
- 19.2 risk_events
- 19.3 BTC/ALT monitoring
- 19.4 alerts
- 19.5 policies
- 19.6 rotation logic
- 19.7 /exit_now /reenter
- 19.8 TG alerts
- 19.9 project_memory integration
- 19.10 simulations
- 19.11 Risk V1
- 19.12 Risk V2/V3

---

# STAGE 20 — ПСИХО-МОДУЛЬ (SUPPORT MODE, SOURCE-FIRST)

- 20.1 psych_topics table
- 20.2 psych_techniques table
- 20.3 psych_system_prompt
- 20.4 mood_signal (soft analysis)
- 20.5 safe_policies (no diagnosis, no therapy replacement)
- 20.6 sources via Sources Layer
- 20.7 /psy /mood /technique (skeleton)
- 20.8 role gates
- 20.9 psych_events (skeleton)
- 20.10 retention minimal, privacy-first
- 20.11 Safety rules (hard): no diagnosis / no labels / no therapy claims

---

## 5) CRITICAL FIXATION (APPENDIX — MUST REMAIN AT EOF)

1. RULE — SG survives model replacement
2. RULE — removing spec-AI must not break tasks
3. RULE — expensive AI requires confirmation
4. RULE — system correctness > AI intelligence
