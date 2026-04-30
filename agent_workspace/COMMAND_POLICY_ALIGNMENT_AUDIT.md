# COMMAND_POLICY_ALIGNMENT_AUDIT.md

Дата: 2026-04-30  
Статус: AUDIT / NO RUNTIME CHANGES  
Ветка: `audit/command-policy-alignment-2026-04-30`  
Основание: `src/core/commandPolicy/commandInventory.js`

---

# 0. Цель

Проверить расхождения между новой read-only картой команд и старыми картами доступа:

```text
commandInventory.js
CMD_ACTION
PRIVATE_ONLY_COMMANDS
commandPolicies.js
```

Важно:
- этот файл ничего не меняет в runtime;
- этот файл не подключает `commandInventory` к выполнению команд;
- этот файл не усиливает привязку СГ к slash-командам;
- цель — подготовить старые команды к изоляции в Technical Mode.

---

# 1. Главный вывод

`commandInventory` теперь шире и ближе к фактическим dispatchers, чем старые карты.

Текущее состояние:

```text
commandInventory = новая полная read-only карта старого Technical Mode слоя
PRIVATE_ONLY_COMMANDS = частично широкая, но Telegram/private-only legacy-карта
commandPolicies = среднее покрытие, но не полное
CMD_ACTION = сильно устаревшая и неполная карта action ids
```

---

# 2. Важное архитектурное уточнение

`commandInventory` не должен становиться новым мозгом СГ.

Правильно:

```text
slash command -> Technical Mode registry -> policy/risk gate
natural language -> Living SG -> meaning -> capability -> permission -> risk -> confirmation
```

Неправильно:

```text
natural phrase -> match commandInventory -> run slash command
```

---

# 3. CMD_ACTION отстаёт сильнее всего

`CMD_ACTION` содержит только ограниченный набор команд:

- profile/mode/link;
- repo/workflow часть;
- task базу;
- price/sources;
- `/pm_set`;
- `/confirm_project_action`.

Но в runtime уже есть значительно больше команд.

## 3.1 Команды, которые есть в inventory/runtime, но отсутствуют в CMD_ACTION

### Task Engine

```text
/start_task
/stop_tasks_type
/stop_all_tasks
/stop_all
```

### System / identity / admin

```text
/health
/project_status
/build_info
/chat_on
/chat_off
/chat_status
/group_source_on
/group_source_off
/group_sources
/my_seen_chats
/group_source_meta
/group_source_topic_diag
/grant
/revoke
/grants
/users_stats
/identity_diag
/identity_backfill
/identity_upgrade_legacy
/identity_orphans
/identity_legacy_tg
```

### Diagnostics / utility

```text
/last_errors
/task_status
/file_logs
/command_policy_diag
/command_policy_selftest
/command_policy_shadow_last
/intent_action_selftest
/meaning_intent_selftest
/meaning_router_selftest
```

### Memory diagnostics

```text
/memory_status
/memory_diag
/memory_integrity
/memory_backfill
/memory_user_chats
/memory_longterm_diag
/memory_type_stats
/memory_fetch_type
/memory_fetch_key
/memory_summary_service
/memory_select_context
/memory_format_context
/memory_prompt_bridge
/memory_reclassify_explicit
```

### Project Memory

```text
/pm_wiring_diag
/pm_show_diag
/pm_context_diag
/pm_shadow_context_diag
/pm_shadow_restore_controlled_diag
/pm_surface_diag
/pm_find_diag
/pm_controlled_diag
/pm_capabilities
/pm_capabilities_diag
/pm_show
/pm_list
/pm_latest
/pm_digest
/pm_find
/pm_session
/pm_session_update
/pm_session_controlled_diag
/pm_sessions_diag
/pm_sessions
/pm_session_show
/pm_confirmed_write
/pm_confirmed_update
/pm_update
/pm_confirmed_list
/pm_confirmed_latest
/pm_last
/pm_confirmed_digest
/pm_confirmed_context
/pm_context
/pm_confirmed_scope_debug
```

### Render / ops / agent workspace

```text
/render_diag
/render_log_set
/render_diag_last
/render_log_show
/render_errors_last
/render_deploys_last
/render_bridge_service
/render_bridge_services
/render_bridge_errors
/render_bridge_logs
/render_bridge_diagnose
/render_bridge_deploys
/render_bridge_deploy
/render_bridge_diag
/agent_workspace_diag
/agent_workspace_run
/agent_workspace_render_report
/agent_workspace_test_note
```

### Crypto/dev/file intake

```text
/ta_debug
/ta_debug_full
/ta_snapshot
/ta_snapshot_full
/ta_core
/ta_core_full
/news_rss
/news_rss_full
/multi_monitor
/multi_monitor_full
/crypto_diag
/crypto_diag_full
/cg_vfuse
/cg_vfuse_full
/bn_ticker
/bn_ticker_full
/okx_ticker
/okx_ticker_full
/okx_candles
/okx_candles_full
/okx_snapshot
/okx_snapshot_full
/okx_diag
/okx_diag_full
/file_intake_diag
/file_intake_diag_full
/vision_diag
```

### Meta/debug/recall/legacy/decision

```text
/chat_meta_debug
/webhook_info
/behavior_events_last
/be_emit
/recall
/recall_more
/ar_list
/help
/diag_decision
/diag_decision_last
/diag_decision_stats
/diag_decision_db_stats
/diag_decision_last_db
/diag_decision_window
/diag_decision_promotion
```

---

# 4. PRIVATE_ONLY_COMMANDS покрывает много, но не всё

`PRIVATE_ONLY_COMMANDS` широкая legacy-карта, но она не является полноценным source of truth.

Проблемы:

1. Она знает только про private-only, но не знает:
   - capability;
   - action type;
   - risk level;
   - confirmation requirement;
   - dispatcher;
   - future Living SG boundary.

2. Она не должна быть единственным источником политики.

3. Она Telegram/private ориентирована, а СГ должен быть мультиплатформенным.

---

# 5. commandPolicies.js покрывает больше, но тоже неполный

`commandPolicies.js` уже содержит важное архитектурное предупреждение:

```text
normal SG conversation must remain natural-language driven
DO NOT bind ordinary user intent to fixed phrases, words, or templates here
```

Это правильно.

Но покрытие не полное относительно `commandInventory`.

## 5.1 Команды из inventory, которых не видно в commandPolicies.js

Примеры:

```text
/health
/project_status
/users_stats
/memory_monarch_diag
/memory_longterm_diag
/memory_type_stats
/memory_fetch_type
/memory_fetch_key
/memory_summary_service
/memory_select_context
/memory_format_context
/memory_prompt_bridge
/memory_reclassify_explicit
/pm_wiring_diag
/pm_show_diag
/pm_context_diag
/pm_shadow_context_diag
/pm_shadow_restore_controlled_diag
/pm_surface_diag
/pm_find_diag
/pm_controlled_diag
/pm_capabilities
/pm_capabilities_diag
/pm_show
/pm_session_controlled_diag
/pm_sessions_diag
/pm_confirmed_context
/pm_confirmed_scope_debug
/last_errors
/task_status
/file_logs
/render_diag_last
/render_log_show
/render_errors_last
/render_deploys_last
/recall
/recall_more
/ar_list
/help
```

---

# 6. Риски

## 6.1 Главный риск

Пока существуют параллельные карты:

```text
CMD_ACTION
PRIVATE_ONLY_COMMANDS
commandPolicies
commandInventory
```

может быть расхождение:

```text
команда есть в dispatcher,
но не в action map,
или private-only есть,
но нет risk/confirmation,
или policy есть,
но inventory не отражает реальный риск.
```

## 6.2 Самые опасные команды

```text
/render_bridge_deploy
/agent_workspace_run
/stop_all_tasks
/stop_all
/memory_backfill
/memory_reclassify_explicit
/identity_backfill
/identity_upgrade_legacy
/pm_confirmed_write
/pm_confirmed_update
/pm_update
/be_emit
/grant
/revoke
/reindex
```

Эти команды должны быть:

```text
monarchOnly = true
privateOnly = true
requiresConfirmation = true
Technical Mode only
logged/audited
```

---

# 7. Рекомендованный порядок выравнивания

## Step 1 — не трогать Living SG

Не использовать `commandInventory` для natural-language routing.

## Step 2 — добавить checker, но не gate

Создать read-only diagnostic checker:

```text
commandInventoryCoverageCheck
```

Он должен сравнивать:

```text
commandInventory vs CMD_ACTION
commandInventory vs PRIVATE_ONLY_COMMANDS
commandInventory vs commandPolicies
```

И выводить отчёт без изменения поведения.

## Step 3 — постепенно заменить CMD_ACTION

Не расширять бесконечно `CMD_ACTION` вручную.

Лучше:

```text
commandInventory -> derived action id / capability id
```

Но только после тестов.

## Step 4 — заменить PRIVATE_ONLY_COMMANDS на policy-derived set

Будущее:

```text
PRIVATE_ONLY_COMMANDS = generated/derived from command policy
```

Но пока не делать.

## Step 5 — единый policy gate

Финальная цель:

```text
slash command
-> commandInventory/commandPolicy
-> monarch/private/transport/risk/confirmation
-> handler
```

---

# 8. Что НЕ делать

Не делать:

```text
natural user text -> commandInventory lookup -> execute command
```

Не делать:

```text
всё слить в CMD_ACTION и считать задачу решённой
```

Не делать:

```text
удалять PRIVATE_ONLY_COMMANDS резко
```

Не делать:

```text
подключать inventory как runtime-gate без shadow mode
```

---

# 9. Вывод

`commandInventory` — правильная карта старого Technical Mode слоя.

Но сейчас есть расхождение:

```text
CMD_ACTION сильно отстаёт
PRIVATE_ONLY_COMMANDS широкая, но legacy
commandPolicies полезная, но неполная
```

Следующий безопасный шаг:

```text
создать read-only coverage checker
без влияния на runtime decisions
```

После этого можно будет аккуратно двигаться к единому policy source.
