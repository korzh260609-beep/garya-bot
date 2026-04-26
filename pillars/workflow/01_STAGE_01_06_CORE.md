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

### Notes (factual)

- Current behavior-events verification surface is active via `/behavior_events_last` (monarch-private).
- Legacy event types `style_axis_used` and `criticality_used` are hidden by default in output and shown only with explicit `legacy` flag.
- Current runtime snapshot event is `behavior_snapshot_used` with compact rendering; raw metadata is shown only with explicit `raw` flag.
- `clarification_asked` logging is active for short single-question clarification replies.
- Workflow names in the FUTURE subsection may lag behind runtime event evolution; repository/runtime remain the source of truth for active event names.

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
- Render diagnostics currently have two active command surfaces:
  - legacy short commands (`/render_diag`, `/render_log_set`, `/render_diag_last`, `/render_log_show`, `/render_errors_last`, `/render_deploys_last`)
  - RenderBridge commands (`/render_bridge_*`)
- These surfaces are not proven duplicates and must not be deleted without runtime usage audit.

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
