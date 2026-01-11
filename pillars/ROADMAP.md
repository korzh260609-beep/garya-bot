# SG AI SYSTEM — ROADMAP (ORDER OF SYSTEM EVOLUTION)
> Назначение: этот файл задаёт **единственно допустимый порядок развития СГ**.  
> Он нужен, чтобы СГ и люди **не принимали преждевременных решений**, не трогали запрещённые зоны и не «ломали скелет» ради удобства.
>
> Формат:
> - ✅ = сделано / допускается использовать
> - ❌ = не сделано / трогать нельзя (кроме явно помеченного SKELETON)
> - (SKELETON) = можно создать только каркас, **без “реальной” логики/масштабирования**, чтобы не ломать прод
>
> Главный принцип: **сначала Foundation → потом Safety/Observability → потом расширения**.

---

## GLOBAL RULES (HARD)
- GLOBAL RULE — AI is execution only, SG is decision maker
- GLOBAL RULE — specialized AI first, reasoning AI last
- GLOBAL RULE — no direct AI calls, only via router
- GLOBAL RULE — every AI call is logged with cost + reason
- GLOBAL RULE — BehaviorCore is independent from AnswerMode (length ≠ style)
- GLOBAL RULE — short/normal/long preserve the same SG personality
- GLOBAL RULE — unclear intent → max 1 soft clarifying question
- GLOBAL RULE — soft form / hard essence (risk-first, no “ты неправ”)

---

## ROADMAP FLOW (CANONICAL ORDER)
Core → DB/TaskEngine → Access V0 → Multi-Channel Identity → DB Migrations → Observability → Transport → Memory V1 → Chat History → Recall Engine → Already-Seen → Answer Modes → Sources → File-Intake → Capability Extensions → V8 Initiative → V9 PR/DIFF → Real Integrations → Multi-Model → Hybrid Intelligence → Legal & Billing → Risk & Market Protection → ПСИХО-МОДУЛЬ

---

# ✅ ЭТАП 1 — БАЗОВАЯ ИНФРАСТРУКТУРА
✅ 1.1 Telegram-бот  
✅ 1.2 Node.js + Express  
✅ 1.3 Webhook + Render  
✅ 1.4 Базовый ответ бота  

---

# ❌ ЭТАП 2 — БАЗА ДАННЫХ + TASK ENGINE V0
✅ 2.1 PostgreSQL  
✅ 2.2 Таблицы users / chat_memory / tasks / sources / logs / project_memory  
✅ 2.3 Demo-task  
✅ 2.4 Команды /tasks /run /newtask  
✅ 2.5 Логирование interaction_logs  

## ❌ 2.6 DB MIGRATIONS (SKELETON — чтобы не ломать прод)
❌ 2.6.1 migrations framework (node-pg-migrate/knex/любое одно)  
❌ 2.6.2 schema_version (таблица/мета) + порядок применения  
❌ 2.6.3 миграции только вперёд (no manual SQL in prod)  

## ❌ 2.7 JOB QUEUE / WORKERS (SKELETON — без реального scaling)
❌ 2.7.1 единый JobRunner интерфейс (enqueue/run/ack/fail)  
❌ 2.7.2 idempotency_key для задач (task_run_key)  
❌ 2.7.3 retry policy skeleton (max_retries/backoff/jitter)  
❌ 2.7.4 DLQ skeleton (dead-letter "кладбище", но не включаем)  

## ❌ 2.8 EXECUTION SAFETY (SKELETON)
❌ 2.8.1 "ровно один запуск" для cron-задач (db-lock / advisory lock)  
❌ 2.8.2 защита от дублей при рестарте (run_key + unique)  

## ❌ 2.9 Interaction Hygiene (SKELETON)
❌ 2.9.1 no pressure / no user evaluation / no “я же говорил”  

---

# ❌ ЭТАП 3 — ACCESS V0 (MINIMUM GATE)
✅ 3.1 Идентификация user / chat  
✅ 3.2 Роли: guest / monarch  
✅ 3.3 can(user, action) — минимальный  
✅ 3.4 Запрет автозадач и admin-команд для guest  
✅ 3.5 Rate-limit на команды  
⚠️ Без GRANTS, без citizen/vip — только защита позвоночника  

## ❌ 3.6 CONFIG / SECRETS HYGIENE (SKELETON)
❌ 3.6.1 dev/staging/prod env mapping (строго)  
❌ 3.6.2 secrets rotation hooks (ключи/токены)  
❌ 3.6.3 feature flags storage (таблица/конфиг, без хардкода)  

---

# ❌ ЭТАП 4 — MULTI-CHANNEL IDENTITY (FOUNDATION — обязательно)
✅ 4.1 ввести global_user_id (единая идентичность)  
❌ 4.2 platform_user_id (TG/Discord/др.) хранить только как привязки  
❌ 4.3 таблица user_identities/user_links (global_user_id ↔ platform ↔ platform_user_id)  
❌ 4.4 linking flow (код/подтверждение) + команды/UX (минимально)  
❌ 4.5 can()/roles/plans привязываются к global_user_id, а не к платформе  
❌ 4.6 запрет: отдельные роли/лимиты "по платформам"  

---

# ❌ ЭТАП 5 — OBSERVABILITY V1
✅ 5.1 task_runs  
✅ 5.2 source_runs  
✅ 5.3 error_events  
✅ 5.4 retries / fail-reasons  
✅ 5.5 /health  
✅ 5.6 /last_errors  
✅ 5.7 /task_status  
✅ 5.8 chat_messages_count  

❌ 5.9 recall_requests  
❌ 5.10 recall_errors  
❌ 5.11 already_seen_hits  
❌ 5.12 already_seen_cooldown_skips  
❌ 5.13 db_size_warning (70% / 85% thresholds)  

## ❌ 5.14 SCALING METRICS (SKELETON)
❌ 5.14.1 queue_depth (если появится очередь)  
❌ 5.14.2 dlq_count (если появится DLQ)  
❌ 5.14.3 webhook_dedupe_hits (idempotency)  
❌ 5.14.4 lock_contention (cron/db-lock)  

## ❌ 5.15 ADMIN ALERTS (SKELETON — без дашбордов)
❌ 5.15.1 алерт монарху: db_size_warning / repeated source failures / queue stuck  

## ❌ 5.16 behavior_events (SKELETON)
❌ 5.16.1 clarification_asked  
❌ 5.16.2 risk_warning_shown  
❌ 5.16.3 answer_mode_changed  
❌ 5.16.4 style_axis_used  

## ❌ 5.xx GROUP-SOURCES METRICS (SKELETON)
❌ 5.xx.1 cross_group_recall_requests  
❌ 5.xx.2 cross_group_recall_hits  
❌ 5.xx.3 privacy_blocks (policy запретил)  
❌ 5.xx.4 redaction_applied_count  
❌ 5.xx.5 top_source_groups (alias, hits) — только монарху  

---

# ❌ ЭТАП 6 — TRANSPORT LAYER (SKELETON)
✅ 6.1 Понятие TransportAdapter  
✅ 6.2 Унифицированный context (user/chat/role/lang/input)  
✅ 6.3 handleMessage(context)  
❌ 6.4 Telegram → Adapter  
❌ 6.5 Discord Adapter (skeleton)  
❌ 6.6 Web / API Adapter (skeleton)  
❌ 6.7 Email Adapter (skeleton)  

## ❌ 6.8 MULTI-INSTANCE SAFETY (SKELETON)
❌ 6.8.1 общий "dedupe key" на уровне adapter → core  
❌ 6.8.2 adapter не делает side-effects без idempotency  

## ✅ 6.9 MULTI-CHANNEL RULES (FOUNDATION — жёстко)
✅ 6.9.1 Core/Memory/Access единые, Transport — тонкий интерфейс  
❌ 6.9.2 запрет: Transport не хранит память/права/бизнес-логику  
❌ 6.9.3 Transport получает global_user_id из Identity layer (ЭТАП 4)  
❌ 6.9.4 смена канала ≠ новая личность  

⚠️ Только скелет. Без реальных интеграций.

---

# ❌ ЭТАП 7 — MEMORY LAYER V1
✅ 7.1 Запись памяти  
✅ 7.2 Чтение памяти  
✅ 7.3 Контекстная выборка  
✅ 7.4 Долговременная память  
✅ 7.5 Анти-дубли  
✅ 7.6 ROBOT mock-monitor  

## ❌ 7.7 MemoryService CONTRACT (SKELETON)
❌ 7.7.1 единый интерфейс: write/read/context/recent  
❌ 7.7.2 запрет прямых SQL-запросов к памяти из хэндлеров  

---

# ❌ ЭТАП 7A — PROJECT MEMORY LAYER (VOICE FOUNDATION)
✅ 7A.1 Структура Project Memory  
✅ 7A.2 Таблица project_memory  
✅ 7A.3 Модель project-context  
✅ 7A.4 Автовосстановление проекта  
✅ 7A.5 getProjectSection / upsertProjectSection  
✅ 7A.6 Loader  
✅ 7A.7 Команды /pm_set /pm_show  

❌ 7A.V1 Speech → Text (STT SKELETON, no provider binding)  
❌ 7A.V2 Voice → AI Router (text only, no reasoning forced)  
❌ 7A.V3 Text → Speech (TTS SKELETON, notifications only)  

---

# ❌ ЭТАП 7B — CHAT HISTORY (LONG-TERM / POINT-RECALL / FREE-TIER SAFE)
❌ 7B.1 Таблица chat_messages (полные сообщения, но safe-ограничения)
- ❌ id (BIGSERIAL)  
- ❌ chat_id  
- ❌ user_id  
- ❌ role  
- ❌ direction(in/out)  
- ❌ text (TRUNCATED)  
- ❌ text_hash (anti-duplicate)  
- ❌ is_truncated (bool)  
- ❌ created_at  
- ❌ platform  
- ❌ platform_message_id  
- ❌ meta(jsonb)  
- ❌ archived_at (NULL, future)  
- ❌ storage_tier (hot/warm/cold, future)  

❌ 7B.2 Индексы (быстро и дёшево)  
❌ 7B.2.1 index (chat_id, created_at DESC)  
❌ 7B.2.2 unique (chat_id, platform_message_id)  
❌ 7B.2.3 index (chat_id, text_hash)  

❌ 7B.3 Логирование каждого входящего сообщения  
❌ 7B.4 Логирование каждого ответа СГ  

## ❌ 7B.5 Free-tier защита от "раздувания базы"
❌ 7B.5.1 Жёсткий лимит text (например 8–16 KB)  
❌ 7B.5.2 Не хранить вложения/бинарь — только ссылки/мета  
❌ 7B.5.3 Флаг truncated=true если обрезано  

## ❌ 7B.6 Retention-policy skeleton (НЕ включаем сейчас)
❌ 7B.6.1 guest_retention_days (config)  
❌ 7B.6.2 citizen_retention_days (config)  
❌ 7B.6.3 monarch_retention_days = unlimited (config)  
❌ 7B.6.4 ARCHIVE_ENABLED=false (config)  

## ❌ 7B.7 IDEMPOTENCY CORE (SKELETON — критично)
❌ 7B.7.1 входящие апдейты: "process-once" по platform_message_id  
❌ 7B.7.2 защита от гонок (insert-first + unique violation handling)  
❌ 7B.7.3 корректная обработка retry от Telegram/webhook  

⚠️ Chat History ≠ Memory. Это «история фактов для точечного поиска по времени».  
⚠️ Нельзя отправлять “месяцы переписки” в ИИ — только фрагменты.

## ❌ 7B.8 GROUPS AS SOURCES — CHAT REGISTRY META (FOUNDATION)
❌ 7B.8.1 chat_meta table (chat_id, platform, chat_type(dm/group), title, alias, created_at)  
❌ 7B.8.2 alias обязателен для group-source (людям показываем только alias)  
❌ 7B.8.3 title хранить как сервисное поле (не показывать пользователям по умолчанию)  

## ❌ 7B.9 GROUP SOURCE FLAGS
❌ 7B.9.1 source_enabled boolean (default=false)  
❌ 7B.9.2 privacy_level enum: public_source / members_only / monarch_only  
❌ 7B.9.3 allow_quotes=false (hard)  
❌ 7B.9.4 allow_raw_snippets=false (hard)  

## ❌ 7B.10 REDACTION RULES (HARD)
❌ 7B.10.1 вычищать @mentions / profile-ссылки  
❌ 7B.10.2 вычищать телефоны/e-mail/явные идентификаторы  
❌ 7B.10.3 safe-truncate фрагментов (например 400–800 chars)  
❌ 7B.10.4 запрет дословных цитат в cross-group (no quotes)  

---

# ❌ ЭТАП 8A — RECALL ENGINE (MVP — БЕЗ embeddings)
❌ 8A.1 Парсер дат/периодов (YYYY-MM-DD, DD.MM.YYYY)  
❌ 8A.2 Выборка по дате (окно суток) + лимит (например 20)  
❌ 8A.3 Выборка по диапазону (from/to) + лимит  
❌ 8A.4 Фильтр по ключевым словам (ILIKE) внутри окна  
❌ 8A.5 Paging: /recall_more (cursor по created_at/id)  
❌ 8A.6 Команда /recall [keyword] (MVP)  

## ❌ 8A.7 RecallService CONTRACT (SKELETON)
❌ 8A.7.1 recallByDate/Range/Keyword/paging  
❌ 8A.7.2 лимиты выдачи + safe-truncation  

## ❌ 8A.8 CROSS-CHAT RECALL (GROUPS AS SOURCES, PRIVACY-SAFE)
❌ 8A.8.1 scope: local_only / include_groups  
❌ 8A.8.2 группы = только source_enabled=true  
❌ 8A.8.3 фильтр по privacy_level (ЭТАП 11)  
❌ 8A.8.4 default = local_only  

## ❌ 8A.9 ANON OUTPUT (карточки, не сообщения)
❌ 8A.9.1 {group_alias, date, topic, summary, confidence}  
❌ 8A.9.2 без цитат и без идентификаторов  
❌ 8A.9.3 лимит summary + safe-truncate  

## ❌ 8A.10 /recall UX С ГРУППАМИ (на старте — monarch only)
❌ 8A.10.1 /recall [keyword] — local_only  
❌ 8A.10.2 /recall [keyword] --groups (monarch only)  
❌ 8A.10.3 /recall_more учитывает scope + cursor  

---

# ❌ ЭТАП 8B — "ЭТО УЖЕ БЫЛО" (ALREADY-SEEN DETECTOR)
❌ 8B.1 ExtractQuery (3–7 ключевых слов + нормализация)  
❌ 8B.2 FastLookup (chat_messages: keyword + hash)  
❌ 8B.3 Confidence rule (только осмысленные совпадения)  
❌ 8B.4 Anti-spam cooldown (например 10 минут)  
❌ 8B.5 Output: 1–2 строки с датой  
❌ 8B.6 Role-based глубина поиска (config)  
❌ 8B.7 CROSS-GROUP HINT (ANON) + отдельный cooldown  

---

# ❌ ЭТАП 9 — ANSWER MODES
✅ 9.1 short / normal / long  
✅ 9.2 Adaptation Layer  
✅ 9.3 systemPrompt под режимы  
✅ 9.4 Интеграция в callAI  
✅ 9.5 Команда /mode  

## ❌ 9.6 BehaviorCore V1 (FOUNDATION)
❌ 9.7 Style Axis (SKELETON): tech / humanitarian / mixed  
❌ 9.8 Soft Style Ask (SKELETON)  
❌ 9.9 Criticality Levels V1 (SKELETON)  
❌ 9.10 No-Nodding Rule (HARD) — forbid blind agreement  

---

# ❌ ЭТАП 10 — SOURCES LAYER
✅ 10.1 Таблица sources  
✅ 10.2 ensureDefaultSources  
✅ 10.3 fetchFromSourceKey  
✅ 10.4 HTML  
✅ 10.5 RSS  
✅ 10.6 CoinGecko Simple Price  
✅ 10.7 Команды /sources /source  
✅ 10.7.3 /test_source  
✅ 10.8 source_checks  
✅ 10.9 diagnoseSource  
✅ 10.10 /diag_source  
✅ 10.11 runSourceDiagnosticsOnce  
✅ 10.12 Source-permissions  
✅ 10.13 Source-rate-limits  
✅ 10.14 Source-logs  

## ❌ 10.15 SOURCE CACHE (SKELETON — cache-first)
❌ 10.15.1 source_cache (key, payload, fetched_at, ttl_sec)  
❌ 10.15.2 hit/miss метрики → ЭТАП 5  
❌ 10.15.3 on-demand + TTL (без cron по умолчанию)  

## ❌ 10.16 GROUPS AS SOURCES (SKELETON)
❌ 10.16.1 source_type: telegram_group_history (key = tg_group:<chat_id>)  
❌ 10.16.2 resolve alias через chat_meta  
❌ 10.16.3 доступ через Access policy (ЭТАП 11)  

---

# ❌ ЭТАП 10C — COINGECKO MODULE (V1)
✅ 10C.1 Скелет модуля  
✅ 10C.2 V1 — базовые данные  
✅ 10C.3 Команды /price /prices  
✅ 10C.4 Интеграции  
⏸️ 10C.PAUSE — Free-tier IP rate-limit (Render NAT), cache-first  

❌ 10C.5 V2 — исторические данные  
❌ 10C.6 Индикаторы  
❌ 10C.7 TA-модуль  
❌ 10C.8 Новости  
❌ 10C.9 Мульти-мониторинг  
❌ 10C.10 Диагностика  
❌ 10C.11 CG V-Fuse  
❌ 10C.12 API-ключ  

---

# ❌ ЭТАП 11 — ACCESS MODULE (EXPANDED)
✅ 11.1 Идентификация пользователя  
✅ 11.2 Роли: guest / monarch  
✅ 11.3 Монарх-гейт  
✅ 11.4 Защита критических команд  
✅ 11.5 /users_stats  
❌ 11.6 Роль citizen  
❌ 11.7 Роль vip  
✅ 11.8 Permissions-layer can(user, action)  
✅ 11.9 Access rules для sources  
✅ 11.10 Access rules для tasks  

## ✅ 11.11 Access Request system (V1 — завершён)
✅ 11.11.1 accessRequests.js  
⏸️ 11.11.2 UX / оплата (пауза)  
✅ 11.11.3 /approve  
✅ 11.11.4 /deny  
✅ 11.11.5 access_requests (таблица + auto-create)  
✅ 11.11.6 Реальный триггер от guest (подтверждено)  

## ❌ 11.12 Редактируемые доступы (GRANTS)
❌ 11.12.1 grants skeleton  
❌ 11.12.2 интеграция в can()  
❌ 11.12.3 /grant /revoke /grants  
❌ 11.12.4 запрет project/admin  
❌ 11.12.5 audit / logs  

## ❌ 11.13–11.16 Recall/Already-Seen gates + audit (SKELETON)
❌ 11.13 Access rules для /recall (role-based limits)  
❌ 11.14 Rate-limit для /recall  
❌ 11.15 Access rules для Already-Seen  
❌ 11.16 AUDIT EVENTS (кто/что/когда) + алерты монарху  

## ❌ 11.17–11.19 GROUP SOURCE POLICIES (PRIVACY GATE)
❌ 11.17 политики видимости group-sources по ролям  
❌ 11.17.2 запрет выдачи author identity (hard)  
❌ 11.17.3 запрет цитат (hard)  
❌ 11.18 admin-команды для group-sources (monarch only)  
❌ 11.19 audit для cross-group recall  

---

# ❌ ЭТАП 11F — FILE-INTAKE SKELETON (SPECIALIZED AI GATE)
✅ 11F.1 download file  
✅ 11F.2 detect type  
✅ 11F.3 process file (routing + stub)  
❌ 11F.4 OCR img (VISION SKELETON, extract only, no analysis)  
❌ 11F.5 PDF parse  
❌ 11F.6 Docx parse  
❌ 11F.7 Audio transcript (STT SKELETON)  
✅ 11F.8 Integration  
✅ 11F.9 effectiveUserText  
✅ 11F.10 logs  

❌ 11F.10.1 Soft-UX without Vision (text fallback mandatory)  

## ❌ 11F.11 DATA LIFECYCLE (SKELETON)
❌ 11F.11.1 хранить только meta/links + retention hooks (future)  

❌ 11F.12 AI-ROUTING RULE — file-type → specialized AI only  

---

# ❌ ЭТАП 12A — CAPABILITY EXTENSIONS (SPECIALIZED AI ROLES)
❌ 12A.1 Diagram / Chart Capability  
❌ 12A.2 Document Generation Capability  
❌ 12A.3 Code / Repo Analysis Capability (CODE-AI SKELETON)
- ❌ 12A.3.1 analysis + diff only (no deploy)  
- ❌ 12A.3.2 output → suggestions, not actions  
❌ 12A.4 Automation / Webhook Capability  
❌ 12A.5 Capability Registry  

---

# ❌ ЭТАП 12 — FILE-INTAKE V2 (REALIZATION)
❌ 12.1 OCR Vision (provider-agnostic)  
❌ 12.2 Keyframe OCR (video frames only)  
❌ 12.3 UI  
❌ 12.4 PDF-parser  
❌ 12.5 DOCX/TXT/RTF  
❌ 12.6 Structuring  
❌ 12.7 Whisper-like STT (speech → text only)  
❌ 12.8 Emotion (safe)  
❌ 12.9 Voice notes (STT + store, no reasoning)  
❌ 12.10 Audio extraction  
❌ 12.11 Vision analysis (FACT extraction only)  
❌ 12.12 Tags  
❌ 12.13 Vision → Structured JSON (no free text)  

---

# ❌ ЭТАП 13 — V8 INITIATIVE (SELF-DIAGNOSTICS / IMPROVEMENTS)
❌ 13.1 Улучшения  
❌ 13.2 Поиск слабых мест  
❌ 13.3 Архитектурный аудит  
❌ 13.4 UX-аудит  
❌ 13.5 Улучшения модулей  

## ❌ 13.6 Comfort-by-default (SKELETON)
❌ 13.6.1 pressure detection  
❌ 13.6.2 over-philosophy detection  
❌ 13.6.3 loss-of-focus detection  

---

# ❌ ЭТАП 14 — V9 PR / DIFF (CODE-AI USAGE)
❌ 14.1 PR generation via Code-AI (proposal only)  
❌ 14.2 Auto-diff via Code-AI (read-only)  
❌ 14.3 Пояснения  
❌ 14.4 Предложения  
✅ 14.5 Human approval mandatory (hard rule)  

---

# ❌ ЭТАП 14A — REAL INTEGRATIONS (ONLY AFTER STAGE 4)
❌ 14A.1 Discord (реализация)  
❌ 14A.2 Web UI / API  
❌ 14A.3 GitHub / Repo Integration  
❌ 14A.4 Diagram Engines  
❌ 14A.5 Zoom / Voice Integration  

## ❌ 14A.6 MULTI-CHANNEL REQUIREMENT (HARD)
❌ 14A.6.1 Discord включается только после ЭТАП 4 (Identity foundation)  
❌ 14A.6.2 каналы обязаны резолвить global_user_id и работать с одной памятью  
❌ 14A.6.3 запрещено: отдельная "память Discord" или роли/лимиты Discord  
❌ 14A.6.4 пользователь продолжает контекст между каналами (same global_user_id)  

---

# ❌ ЭТАП 15 — V10 MULTI-MODEL (REGISTRY + ROUTER V1)
❌ 15.1 Text models registry (GPT / DeepSeek / others)  
❌ 15.2 Specialized models registry (vision / stt / tts / code)  
❌ 15.3 AI Router V1 (task-type based)  
❌ 15.4 Modality detection (text / vision / speech / code)  
❌ 15.5 Fallback policy (spec-AI unavailable → text-only)  
❌ 15.6 Cost tier tagging per model (cheap / normal / expensive)  

---

# ❌ ЭТАП 16 — V11 MULTI-MODEL++ (SMART ROUTING)
❌ 16.1 Automatic modality routing  
❌ 16.2 Cheap-first policy (default)  
❌ 16.3 Reasoning-AI only by explicit need  
❌ 16.4 Parallel spec-AI allowed (vision + stt)  
❌ 16.5 AI usage explanation log (why this model)  

---

# ❌ ЭТАП 17 — V12 HYBRID INTELLIGENCE
❌ 17.1 Hybrid execution (robot-layer + spec-AI + reasoning)  
❌ 17.2 Spec-AI before reasoning-AI (hard rule)  
❌ 17.3 Reasoning as validator, not extractor  
❌ 17.4 Auto-orchestrator with safety caps  
❌ 17.5 AI-Budget Governor (per user / per role)  

---

# ❌ ЭТАП 18 — LEGAL & BILLING (AI COST VISIBILITY)
❌ 18.1 Tariffs & Plans  
❌ 18.2 AI-Credits per AI-type (text / vision / speech / code)  
❌ 18.3 Cost transparency per task  
❌ 18.4 Logs Dashboard  
❌ 18.5 Memory Dashboard  
❌ 18.6 License  
❌ 18.7 Privacy  
❌ 18.8 Model-level audit (who called what and why)  

## ❌ 18.9 DATA RETENTION & EXPORT (SKELETON)
❌ 18.9.1 export user data (по запросу)  
❌ 18.9.2 delete/anonymize hooks (future, role-based)  

---

# ❌ ЭТАП 19 — RISK & MARKET PROTECTION
❌ 19.1 Архитектура  
❌ 19.2 risk_events  
❌ 19.3 Мониторинг BTC / ALT  
❌ 19.4 Alerts  
❌ 19.5 Policies  
❌ 19.6 Rotation Logic  
❌ 19.7 /exit_now /reenter  
❌ 19.8 Alerts TG  
❌ 19.9 project_memory интеграция  
❌ 19.10 Симуляции  
❌ 19.11 Risk V1  
❌ 19.12 Risk V2 / V3  

---

# ❌ ЭТАП 20 — ПСИХО-МОДУЛЬ (SUPPORT MODE, SOURCE-FIRST)
❌ 20.1 psych_topics (таблица)  
❌ 20.2 psych_techniques (таблица)  
❌ 20.3 psych_system_prompt (отдельный промпт)  
❌ 20.4 mood_signal (мягкий анализ)  
❌ 20.5 safe_policies (no диагнозы, no терапия-замена)  
❌ 20.6 sources: книги/статьи/справочники через Sources Layer  
❌ 20.7 команды /psy /mood /technique (skeleton)  
❌ 20.8 role gates: guest ограничено, citizen/monarch шире  
❌ 20.9 observability: psych_events (SKELETON)  
❌ 20.10 data retention: минимально, privacy-first  
❌ 20.11 Safety Rules (HARD): no diagnosis / no labels / no therapy claims  

---

# 🔒 CRITICAL FIXATION (HARD, ADD-TO-END)
- RULE — SG survives model replacement
- RULE — removing spec-AI must not break tasks
- RULE — expensive AI requires confirmation
- RULE — system correctness > AI intelligence

