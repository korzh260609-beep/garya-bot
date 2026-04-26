# ROADMAP — STAGE 1 TO STAGE 6 CORE

---

# STAGE 1 — BASIC INFRASTRUCTURE

1.1 Telegram bot  
1.2 Node.js + Express  
1.3 Webhook + Render  
1.4 Basic bot reply  

Purpose:
- establish minimal always-on bot runtime.

---

# STAGE 2 — DATABASE + TASK ENGINE V0

2.1 PostgreSQL  
2.2 Tables: users / chat_memory / tasks / sources / logs / project_memory  
2.3 Demo task  
2.4 Commands: /tasks /run /newtask  
2.5 interaction_logs  

## 2.6 DB MIGRATIONS SKELETON

2.6.1 migrations framework  
2.6.2 schema_version + migration order  
2.6.3 forward-only migrations  

## 2.7 JOB QUEUE / WORKERS SKELETON

2.7.1 JobRunner interface  
2.7.2 idempotency_key for task runs  
2.7.3 retry policy skeleton  
2.7.4 DLQ skeleton, disabled by default  

## 2.8 EXECUTION SAFETY SKELETON

2.8.1 exactly-one cron execution guard  
2.8.2 restart duplicate protection  

## 2.9 INTERACTION HYGIENE SKELETON

2.9.1 no pressure  
2.9.2 no user evaluation  
2.9.3 no “я же говорил” behavior  

Purpose:
- create the first persistent runtime foundation.

---

# STAGE 3 — ACCESS V0

3.1 Identify user / chat  
3.2 Roles: guest / monarch  
3.3 can(user, action) minimum gate  
3.4 block guest auto-tasks and admin commands  
3.5 command rate-limit  

## 3.6 CONFIG / SECRETS HYGIENE SKELETON

3.6.1 dev / staging / prod env mapping  
3.6.2 secrets rotation hooks  
3.6.3 feature flags storage  

Purpose:
- prevent uncontrolled access before complex features exist.

---

# STAGE 4 — MULTI-CHANNEL IDENTITY

4.1 global_user_id  
4.2 platform_user_id as link only  
4.3 user_identities / user_links  
4.4 linking flow + UX  
4.5 can / roles / plans through global_user_id  
4.6 ban platform-specific roles  

Purpose:
- make memory and permissions user-based, not Telegram-only.

---

# STAGE 5 — OBSERVABILITY V1

5.1 task_runs  
5.2 source_runs  
5.3 error_events  
5.4 retries / fail reasons  
5.5 /health  
5.6 /last_errors  
5.7 /task_status  
5.8 chat_messages_count  
5.9 recall_requests  
5.10 recall_errors  
5.11 already_seen_hits  
5.12 already_seen_cooldown_skips  
5.13 db_size_warning  

## 5.14 SCALING METRICS SKELETON

5.14.1 queue_depth  
5.14.2 dlq_count  
5.14.3 webhook_dedupe_hits  
5.14.4 lock_contention  

## 5.15 ADMIN ALERTS SKELETON

5.15.1 alerts to monarch  

## 5.16 BEHAVIOR EVENTS

5.16.1 behavior_events table  
5.16.2 risk_warning_shown  
5.16.3 rate_limited  
5.16.4 permission_denied  
5.16.5 /behavior_events_last <N>  
5.16.F1 clarification_asked  
5.16.F2 answer_mode_changed  
5.16.F3 style_axis_used  

Purpose:
- make runtime behavior inspectable before adding bigger modules.

---

# STAGE 6 — TRANSPORT LAYER SKELETON

6.1 TransportAdapter  
6.2 Unified context  
6.3 handleMessage(context)  
6.4 Telegram Adapter  
6.5 Discord Adapter  
6.6 Web / API Adapter  
6.7 Email Adapter  

Purpose:
- keep Telegram thin and move logic into core.
