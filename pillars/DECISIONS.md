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

## D-018A: Structured dialogue memory is layered into archive, topic digests, and confirmed memory

Status: ACCEPTED  
Date: 2026-03-22  
Scope: Memory / Recall / Dialogue History

Decision:

SG dialogue-related memory must be split into three separate layers:

1. Raw Dialogue Archive
- stores recoverable dialogue history for future restoration
- is a source for recall and restoration
- is NOT a prompt-facing memory layer by default

2. Topic Digest Layer
- SG may periodically review dialogue history
- SG may group dialogues by topic
- SG may build compact thematic digests/summaries
- digest is intended to compress noise while preserving meaning

3. Confirmed Memory Layer
- stores confirmed facts, decisions, preferences, rules, conclusions, stable patterns
- remains the highest-trust reusable memory layer for future prompt usage

Hard rules:
- raw dialogue must not be injected into prompts as uncontrolled dumps
- topic digests must not replace confirmed memory
- archive, digest, and confirmed memory must remain logically separate
- future recall must support restoration by theme/topic, not only by raw date/log scan
- any automated dialogue digestion must remain reviewable, bounded, and fail-safe
- group attribution and privacy rules remain mandatory

Consequences:
- explicit memory like "запомни ..." remains valid and unchanged
- SG memory architecture is extended beyond simple explicit memory + raw recall
- future dialogue restoration and topic recall are approved directions
- implementation must follow skeleton → config → logic

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

## D-028: RepoIndex contours (A/B/C) + guarded on-demand repo access
Status: ACCEPTED  
Date: 2026-02-17  
Scope: Repo Indexing / Security / Repo Tools

Decision:
Repository visibility and access are split into three contours:

A) Full Tree Snapshot (paths-only)
- SG MUST persist full repository tree (all paths) as metadata only (no content).

B) Content Index (allowlist only)
- SG MAY fetch and index content only for a restricted allowlist.

C) On-demand fetch (guarded)
- SG MAY fetch a specific file content only when explicitly requested.

Monarch-only extra roots:
- migrations/
- .github/

Consequences:
- Full Tree Snapshot is mandatory.
- Secret leak risk is high priority.
- Denylist refinement must be deliberate.

---

## D-029: Stage 3 — Identity Runtime Stabilization Completed
Status: ACCEPTED  
Date: 2026-02-18  
Scope: Identity / DB Stabilization

Decision:
Stage 3 identity runtime is considered stable after structural hardening.

Changes applied:
- Added provider/provider_user_id bind check in confirmLinkCode
- Wrapped confirmLinkCode in transaction + FOR UPDATE
- Added composite index (provider, provider_user_id, status)
- Added CHECK constraints for status fields
- Fixed incorrect pool-level ROLLBACK → client-level ROLLBACK
- Verified runtime via /link_status
- Verified migrations applied on Render

Consequences:
- Identity link confirmation is race-safe
- Status corruption is prevented at DB level
- Runtime behavior validated
- Stage 3 marked stable

---

## D-030: Модель прослушивания групп + исключение Sandbox

Status: ACCEPTED  
Date: 2026-03-04  
Scope: Групповые чаты / Память / Поведение

Decision:

В групповых чатах SG работает по архитектуре **listen-first** (сначала слушает, потом при необходимости отвечает).

1. SG ОБЯЗАН слушать все сообщения в группе для того чтобы:
   - понимать контекст разговора
   - определять автора сообщения
   - формировать долговременную память, связанную с `global_user_id`.

2. SG НЕ ДОЛЖЕН отвечать на каждое сообщение в группе.

3. SG может отвечать в группе ТОЛЬКО при выполнении одного из условий:
   - явное упоминание SG через `@mention`
   - прямой ответ (reply) на сообщение SG
   - явная команда, адресованная SG.

4. Разговоры в группе НЕ должны рассматриваться как один диалог.

   Атрибуция контекста должна происходить на основе:
   - `chat_id`
   - `global_user_id`
   - метаданных сообщения.

5. Допускается специальное исключение — **sandbox режим**.

   Некоторые группы разработки или тестирования могут работать в режиме **assistant**, где SG может инициировать ответы без прямого обращения.

6. Поведение SG в группе управляется конфигурационным параметром:

`chat_mode`

Допустимые значения:

- `observer` (по умолчанию)  
  SG слушает и записывает память, но отвечает только при mention/reply/команде.

- `assistant`  
  SG может активно участвовать в разговоре.

7. Группы в режиме sandbox / assistant должны настраиваться явно и предназначены для:
   - разработки
   - тестирования
   - экспериментов с поведением SG.

Consequences:

- Память записывается для всех сообщений группы независимо от того, отвечает SG или нет.
- Проверка условий ответа должна происходить **до вызова AI**.
- Без `chat_mode=assistant` инициативные ответы SG запрещены.
- Атрибуция контекста всегда должна использовать `global_user_id`.

## D-031: SG Self-Reflection — проактивный самоанализ с согласованием монарха

Status: ACCEPTED  
Date: 2026-03-16  
Scope: SG Behavior / Autonomy Boundary

Decision:

СГ может проактивно анализировать собственную телеметрию и поведение,
формулировать предложения по улучшению и представлять их монарху на согласование.

Разрешено:
- читать собственные таблицы (interaction_logs, behavior_events, audit_events,
  error_events, decision_telemetry, source_runs)
- формулировать предложения по улучшению (код, конфигурация, поведение, этапы)
- ранжировать предложения по приоритету (HIGH / MEDIUM / LOW)
- записывать согласованные предложения в project_memory как задачи

Запрещено:
- применять изменения без явного согласования монарха
- изменять DECISIONS.md, WORKFLOW.md или другие pillars самостоятельно
- инициировать деплой или коммиты
- давать предложения которые нарушают текущие stage gates

Протокол:
1. монарх вызывает /sg_reflect [период]
2. СГ читает телеметрию → анализирует через callAI() → формирует список предложений
3. СГ отправляет предложения монарху с обоснованием и оценкой затрат
4. монарх согласует: /sg_approve <номера> или /sg_decline <номера>
5. согласованные предложения записываются в project_memory как открытые задачи
6. отклонённые предложения логируются в audit_events с причиной

Consequences:
- СГ становится активным участником своего развития в рамках роли советника
- монарх сохраняет полный контроль над всеми изменениями
- D-001 не нарушается: AI предлагает, монарх решает
- D-017 не нарушается: вывод advisory only

## D-032: Агентная система — архитектура и интеграция с СГ

Status: ACCEPTED  
Date: 2026-03-16  
Scope: Agent System / Integration

Decision:

СГ развивается с поддержкой внешней агентной системы для работы с репозиторием,
анализа кода и генерации предложений.

Архитектура агентов:
- Pillar Guardian (Orchestrator, Claude Sonnet) — обязательная точка входа,
  валидирует каждый запрос против WORKFLOW / DECISIONS / ROADMAP
- Research Scout (Gemini Flash) — читает весь репозиторий (1M контекст)
- Reader (Claude Haiku) — читает файлы конкретной зоны по запросу
- Auditor (Claude Haiku) — проверяет результат против pillars
- Coder (Claude Sonnet) — генерирует патчи в формате FULLFILE / INSERT
- Render Monitor (Render MCP) — читает логи, метрики, БД СГ

Конфигурация:
- Конфиг агентов хранится отдельно от логики
- V1: конфиг в артефакте Claude
- После Stage 14A.2: конфиг переезжает в project_memory СГ
- Lovable получает доступ к конфигу через WebAdapter REST API

Жёсткие правила (non-negotiable):
- Агенты не пушат, не коммитят, не деплоят — никогда
- Применение кода только монархом вручную
- Pillar Guardian проверяет stage gate при каждом запросе
- Секреты передаются только через ENV, не через чат

Consequences:
- D-001 не нарушается: агенты предлагают, монарх решает
- D-017 не нарушается: вывод advisory only
- Смена модели агента не требует изменения логики

## D-033: Binance is the primary market microstructure source for SG trading analytics

Status: ACCEPTED  
Date: 2026-03-17  
Scope: Sources / Trading Analytics / Market Data

Decision:

Для торговой аналитики SG использует Binance как основной источник рыночной микроструктуры.

Роли источников фиксируются так:

- CoinGecko:
  - базовые цены
  - historical market chart
  - market cap
  - общий market context
  - fallback / redundancy source

- Binance Spot:
  - klines / uiKlines
  - depth
  - trades / aggTrades
  - avgPrice
  - ticker/24hr

- Binance Futures / Derivatives:
  - open interest
  - funding rate history

Назначение Binance в системе SG:
- свечной анализ
- структура рынка
- уровни поддержки/сопротивления
- order book pressure
- trade flow / tape activity
- derivatives pressure
- market bias fusion

Жёсткие правила:
1. SG не использует один CoinGecko как единственный источник для продвинутого трейдинг-анализа.
2. Для свечного анализа, market structure, стакана, funding и open interest Binance является приоритетным источником.
3. Все вычисления выполняются сначала в robot-layer.
4. AI-layer не вычисляет сырые рыночные данные, а только объясняет уже рассчитанный результат.
5. Источники подключаются поэтапно:
   - сначала candles
   - потом market structure
   - потом depth
   - потом derivatives
   - потом fusion layer
6. Нельзя тащить все market endpoints в каждый отчёт без стратегии лимитов, rate-limit control и нормализации.
7. Spot и Futures рассматриваются как разные контуры данных и не смешиваются без явного слоя нормализации.

Consequences:
- CoinGecko остаётся полезным, но не является достаточным источником для полного TA
- Binance становится главным источником для расширенного market analysis
- Архитектура Sources Layer должна предусматривать отдельные Binance-модули
- Любые будущие торговые отчёты SG должны учитывать различие:
  - price source
  - candles source
  - order book source
  - derivatives source

---

## D-034: Binance paused in current runtime environment; OKX selected as active alternative public market source

Status: ACCEPTED  
Date: 2026-03-19  
Scope: Sources / Runtime Availability / Trading Data

Decision:

В текущей runtime-среде SG публичный Binance API недоступен для практического использования.

Фактически подтверждено:
- Binance public market endpoint returns `HTTP 451`
- ответ содержит restricted-location / eligibility restriction
- проблема относится к доступности провайдера в текущем окружении, а не к wiring кода

Поэтому принимается runtime-решение:

- Binance market module сохраняется в architecture/workflow как стратегически важный источник
- но дальнейшее развитие Binance-модулей в текущей среде ставится на паузу
- активным альтернативным публичным market source в текущем окружении назначается OKX

Роли источников в текущем runtime фиксируются так:

- CoinGecko:
  - base / fallback market source
  - simple price
  - historical market chart
  - broad market context
  - RSS/news-related fusion

- OKX:
  - active public exchange market source in current environment
  - ticker / market endpoint
  - next candidate for candles / snapshot / diagnostics expansion

- Binance:
  - remains strategic target source in architecture
  - paused in current runtime until provider/region accessibility changes

Hard rules:

1. SG must not continue expanding Binance-specific logic in the current environment as if the source were available.
2. Binance runtime failures caused by provider restriction must be treated as provider-access limitation, not as internal system bugs.
3. OKX becomes the active exchange source for next public market-source steps in the current environment.
4. If runtime accessibility changes in the future, Binance may be resumed explicitly without deleting this decision history.
5. Source selection must follow real runtime verification, not assumptions.

Consequences:

- D-033 remains architecturally valid, but is currently constrained by runtime accessibility.
- Stage 10D is effectively paused at current environment level.
- OKX becomes the practical continuation path for exchange-source development.
- Future source fusion and diagnostics in this environment should prioritize OKX over Binance until restrictions are lifted.

---

## D-035: Guest → Citizen promotion is manual-only in V1

Status: ACCEPTED  
Date: 2026-03-20  
Scope: Identity / Access / Promotion Policy

Decision:

В текущей V1-логике SG автоматическое продвижение пользователя
из `guest` в `citizen` НЕ выполняется.

Продвижение guest → citizen допускается только вручную монархом
через административные команды (например, `/grant`).

Любые механизмы auto-promotion:
- по активности
- по количеству сообщений
- по доверию
- по времени использования
- по любым score / telemetry правилам

считаются отключёнными до отдельного явного решения монарха
и отдельного этапа реализации.

Consequences:

- Текущая политика promotion в runtime считается manual-only
- Отсутствие auto-promotion не является bug
- Любая попытка включить auto-promotion без нового decision-entry считается нарушением stage governance
- Тестирование ролей guest/citizen в V1 должно опираться на ручной `/grant` и `/revoke`

---

## D-036: Render command surface policy v1

Status: ACCEPTED  
Date: 2026-03-29  
Scope: Render Diagnostics / Operator Surface / Runtime Tooling

Decision:

Render command surface in SG is split into separate operational groups.
These commands must not be treated as blind duplicates unless runtime usage,
data source, and output responsibility are proven equivalent.

Render command groups are fixed as follows:

1. Manual pasted-log tools
- `/render_diag`

Purpose:
- diagnose log text manually pasted by monarch
- works without live Render API access
- used for ad-hoc analysis of copied logs/messages

2. Local snapshot inbox tools
- `/render_log_set`
- `/render_log_show`
- `/render_diag_last`

Purpose:
- save one chosen log snapshot locally
- inspect the currently saved snapshot
- run diagnosis on the saved snapshot without pasting the log again

3. Local rolling snapshot store tools
- `/render_errors_last`
- `/render_deploys_last`

Purpose:
- inspect already stored rolling snapshots
- provide historical operational view of saved Render events
- this is not a live Render API surface

4. Live RenderBridge / Render API tools
- `/render_bridge_service`
- `/render_bridge_services`
- `/render_bridge_logs`
- `/render_bridge_errors`
- `/render_bridge_diagnose`
- `/render_bridge_deploys`
- `/render_bridge_deploy`
- `/render_bridge_diag`

Purpose:
- work with selected live Render service
- fetch live logs and deploys from Render API
- normalize live data
- optionally persist snapshots
- diagnose live-fetched logs
- inspect RenderBridge subsystem state

Hard rules:

1. No Render command may be removed only because its name looks legacy or overlaps conceptually.
2. Removal is allowed only after:
   - runtime usage is audited
   - source-path and responsibility are proven redundant
   - replacement command is confirmed functionally equivalent
3. Live RenderBridge tools do not automatically replace manual pasted-log tools.
4. Local snapshot tools do not automatically replace live RenderBridge tools.
5. If help surface becomes noisy, secondary Render commands may be hidden from default help, but not deleted.

Preferred operator usage:

- use `/render_bridge_*` when live Render service access is needed
- use `/render_diag` when only copied log text is available
- use `/render_log_set` + `/render_diag_last` when one log snapshot must be frozen and re-checked repeatedly
- use `/render_errors_last` and `/render_deploys_last` for local historical snapshot review

Consequences:

- Render short commands and RenderBridge commands are currently treated as separate operational surfaces
- blind cleanup of Render commands is forbidden
- future cleanup requires overlap audit first

---

## D-037: Render operator primary command set v1

Status: ACCEPTED  
Date: 2026-03-29  
Scope: Render Diagnostics / Monarch Operator UX / Command Usage

Decision:

For daily monarch operation, SG defines a primary Render command set.
This decision does not delete or replace other Render commands.
It only fixes which commands are considered the main operator path.

Primary operator command set:

1. Live Render service workflow
- `/render_bridge_service`
- `/render_bridge_logs`
- `/render_bridge_diagnose`

Purpose:
- choose the active Render service
- inspect fresh live logs from Render API
- get a short diagnosis from live fetched logs

2. Manual pasted-log workflow
- `/render_diag`

Purpose:
- diagnose copied log text when live RenderBridge access is not needed
- use as a fast manual fallback

3. Frozen snapshot workflow
- `/render_log_set`
- `/render_diag_last`

Purpose:
- freeze one chosen log snapshot locally
- re-run diagnosis on the same saved snapshot without pasting it again

4. Historical local snapshot review
- `/render_errors_last`
- `/render_deploys_last`

Purpose:
- inspect already saved rolling snapshots
- use for quick historical review, not for live API inspection

Hard rules:

1. Daily operator guidance must prefer the primary command set above.
2. Secondary Render commands may remain available, but are treated as auxiliary/dev surface.
3. Default operator explanations and future help text should prefer the primary command set first.
4. This decision does not authorize deletion, merge, or renaming of any existing Render command.

Consequences:

- monarch has a fixed minimal Render toolkit for routine work
- command confusion is reduced without breaking existing tooling
- advanced Render commands remain available but are no longer the default first-choice path