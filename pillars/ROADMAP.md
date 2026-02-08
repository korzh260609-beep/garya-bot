# SG AI SYSTEM — ROADMAP (ORDER OF SYSTEM EVOLUTION)
> Назначение: этот файл задаёт **единственно допустимый порядок развития СГ**.  
> Он нужен, чтобы СГ и люди **не принимали преждевременных решений**, не трогали запрещённые зоны и не «ломали скелет» ради удобства.
>
> Формат:
> - статусы намеренно убраны
> - порядок и структура являются источником истины
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

# ЭТАП 1 — БАЗОВАЯ ИНФРАСТРУКТУРА
1.1 Telegram-бот  
1.2 Node.js + Express  
1.3 Webhook + Render  
1.4 Базовый ответ бота  

---

# ЭТАП 2 — БАЗА ДАННЫХ + TASK ENGINE V0
2.1 PostgreSQL  
2.2 Таблицы users / chat_memory / tasks / sources / logs / project_memory  
2.3 Demo-task  
2.4 Команды /tasks /run /newtask  
2.5 Логирование interaction_logs  

## 2.6 DB MIGRATIONS (SKELETON — чтобы не ломать прод)
2.6.1 migrations framework (node-pg-migrate / knex / одно)  
2.6.2 schema_version (таблица / мета) + порядок применения  
2.6.3 миграции только вперёд (no manual SQL in prod)  

## 2.7 JOB QUEUE / WORKERS (SKELETON — без реального scaling)
2.7.1 единый JobRunner интерфейс (enqueue/run/ack/fail)  
2.7.2 idempotency_key для задач (task_run_key)  
2.7.3 retry policy skeleton (max_retries/backoff/jitter)  
2.7.4 DLQ skeleton (dead-letter, но не включаем)  

## 2.8 EXECUTION SAFETY (SKELETON)
2.8.1 ровно один запуск cron-задач (db-lock / advisory lock)  
2.8.2 защита от дублей при рестарте (run_key + unique)  

## 2.9 Interaction Hygiene (SKELETON)
2.9.1 no pressure / no user evaluation / no “я же говорил”  

---

# ЭТАП 3 — ACCESS V0 (MINIMUM GATE)
3.1 Идентификация user / chat  
3.2 Роли: guest / monarch  
3.3 can(user, action) — минимальный  
3.4 Запрет автозадач и admin-команд для guest  
3.5 Rate-limit на команды  

## 3.6 CONFIG / SECRETS HYGIENE (SKELETON)
3.6.1 dev / staging / prod env mapping  
3.6.2 secrets rotation hooks  
3.6.3 feature flags storage  

---

# ЭТАП 4 — MULTI-CHANNEL IDENTITY
4.1 global_user_id  
4.2 platform_user_id как привязка  
4.3 user_identities / user_links  
4.4 linking flow + UX  
4.5 can / roles / plans через global_user_id  
4.6 запрет платформенных ролей  

---

# ЭТАП 5 — OBSERVABILITY V1
5.1 task_runs  
5.2 source_runs  
5.3 error_events  
5.4 retries / fail-reasons  
5.5 /health  
5.6 /last_errors  
5.7 /task_status  
5.8 chat_messages_count  
5.9 recall_requests  
5.10 recall_errors  
5.11 already_seen_hits  
5.12 already_seen_cooldown_skips  
5.13 db_size_warning  

## 5.14 SCALING METRICS (SKELETON)
5.14.1 queue_depth  
5.14.2 dlq_count  
5.14.3 webhook_dedupe_hits  
5.14.4 lock_contention  

## 5.15 ADMIN ALERTS (SKELETON)
5.15.1 alerts монарху  

## 5.16 behavior_events (SKELETON)
5.16.1 clarification_asked  
5.16.2 risk_warning_shown  
5.16.3 answer_mode_changed  
5.16.4 style_axis_used  

---

# ЭТАП 6 — TRANSPORT LAYER (SKELETON)
6.1 TransportAdapter  
6.2 Unified context  
6.3 handleMessage(context)  
6.4 Telegram Adapter  
6.5 Discord Adapter  
6.6 Web / API Adapter  
6.7 Email Adapter  

---

# ЭТАП 7 — MEMORY LAYER V1
7.1 Запись памяти  
7.2 Чтение памяти  
7.3 Контекстная выборка  
7.4 Долговременная память  
7.5 Анти-дубли  
7.6 ROBOT mock-monitor  

## 7.7 MemoryService CONTRACT (SKELETON)
7.7.1 write / read / context / recent  
7.7.2 запрет прямых SQL  

---

# ЭТАП 8 — RECALL / ALREADY-SEEN
8A Recall Engine  
8B Already-Seen Detector  

---

# ЭТАП 9 — ANSWER MODES
9.1 short / normal / long  
9.2 Adaptation Layer  
9.3 systemPrompt  
9.4 callAI integration  
9.5 /mode  

---

# ЭТАП 10 — SOURCES LAYER
10.1 sources table  
10.2 ensureDefaultSources  
10.3 fetchFromSourceKey  
10.4 HTML  
10.5 RSS  
10.6 CoinGecko  
10.7 commands  
10.8 diagnostics  
10.9 logs  

---

# ЭТАП 11 — ACCESS MODULE (EXPANDED)
11.1 roles  
11.2 permissions  
11.3 access requests  
11.4 grants  
11.5 audits  

---

# ЭТАП 12 — FILE INTAKE
12.1 files  
12.2 OCR  
12.3 STT  
12.4 parsing  
12.5 lifecycle  

---

# ЭТАП 13 — V8 INITIATIVE
13.1 diagnostics  
13.2 improvements  
13.3 audits  

---

# ЭТАП 14 — V9 PR / DIFF
14.1 PR proposals  
14.2 diff  
14.3 human approval  

---

# ЭТАП 15 — MULTI-MODEL
15.1 registry  
15.2 router  
15.3 cost tiers  

---

# ЭТАП 16 — HYBRID INTELLIGENCE
16.1 orchestration  
16.2 safety caps  

---

# ЭТАП 17 — LEGAL & BILLING
17.1 tariffs  
17.2 credits  
17.3 transparency  

---

# ЭТАП 18 — RISK & MARKET PROTECTION
18.1 risk events  
18.2 alerts  
18.3 simulations  

---

# ЭТАП 19 — ПСИХО-МОДУЛЬ
19.1 topics  
19.2 techniques  
19.3 safety rules  

---

# CRITICAL FIXATION (HARD)
- SG survives model replacement
- removing spec-AI must not break tasks
- expensive AI requires confirmation
- system correctness > AI intelligence
