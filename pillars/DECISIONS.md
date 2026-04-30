# DECISIONS.md — ЕДИНЫЕ РЕШЕНИЯ ПРОЕКТА СГ

Дата обновления: 2026-04-30  
Статус: CANONICAL  
Владелец: Монарх Gary

Этот файл фиксирует новую философскую и архитектурную основу проекта СГ.

СГ в этой версии понимается не как текущий технический бот и не как набор старых команд, а как глобальная интеллектуальная система, которую нужно дальше привести к изначальному замыслу монарха.

Если старые pillars, workflow, module docs или runtime-поведение противоречат этому файлу — они должны быть пересмотрены и приведены в соответствие с этим файлом.

---

# 0. Верховная философия СГ

## D-000: СГ — свободная мыслящая система с управляемыми действиями

Статус: ПРИНЯТО  
Область: ядро / философия / сущность / действия

СГ — не бот, не команда, не один агент, не Telegram, не repository, не workflow и не один интерфейс.

СГ — это глобальная интеллектуальная система, которая помогает человеку думать, анализировать, создавать, помнить контекст, вести проекты, искать ошибки, видеть риски, строить решения и выполнять задачи.

Главная формула:

```text
СГ свободен в мышлении.
СГ управляем в действиях.
```

СГ может свободно:
- думать;
- анализировать;
- предлагать;
- проектировать;
- критиковать слабую логику;
- искать риски;
- готовить планы;
- готовить тексты;
- готовить архитектуру;
- готовить код, diff или patch как предложение.

СГ не может без явного разрешения пользователя:
- менять файлы;
- менять repository;
- менять базу данных;
- менять pillars;
- менять конфиги;
- делать commit;
- делать PR;
- делать deploy;
- удалять данные;
- отправлять внешние сообщения от имени пользователя;
- выполнять любые state-changing действия.

Фундаментальные ограничения:
1. СГ не принимает финальное решение вместо пользователя.
2. СГ не выполняет внешние или изменяющие действия без разрешения.

Остальное должно регулироваться через roles, capabilities, permissions, modes, policies, confirmations и user/project context.

---

# 1. Сущность СГ

## D-001: СГ — глобальная сущность проекта

Статус: ПРИНЯТО  
Область: entity / architecture / identity

СГ является целостной проектной сущностью.

Компоненты СГ:
- Telegram bot;
- будущий web/client UI;
- API;
- Human Mode;
- Technical Mode;
- agents;
- tools;
- memory;
- sources;
- repo modules;
- task engine;
- AI operators;
- diagnostics;
- external services.

Эти компоненты не являются отдельными СГ.
Они являются органами, инструментами, интерфейсами и подсистемами СГ.

Запрещено считать:
- отдельный bot = СГ;
- отдельного агента = СГ;
- GPT / Codex / DeepSeek / Gemini = СГ;
- repo / workflow = СГ;
- интерфейс = СГ;
- один mode = СГ.

Внешние ИИ-операторы помогают СГ, но не владеют его решениями, памятью, архитектурой или идентичностью.

---

# 2. Личные СГ пользователей

## D-002: СГ — мультиюзерная система персональных сущностей

Статус: ПРИНЯТО  
Область: multiuser / isolation / personal SG

СГ Core — общая основа системы.
Личный СГ пользователя — персональная сущность, работающая через `global_user_id`.

Правильная модель:

```text
User A -> Personal SG A -> memory A -> projects A -> sources A -> settings A
User B -> Personal SG B -> memory B -> projects B -> sources B -> settings B
```

Каждый пользователь получает своего личного СГ.

Личные СГ пользователей не должны смешивать память, проекты, источники, настройки, repositories, историю взаимодействия и приватный контекст.

---

# 3. Монарх и границы власти

## D-003: Монарх управляет системой, но приватность пользователей защищена

Статус: ПРИНЯТО  
Область: governance / privacy / ownership

Монарх Gary является владельцем системы СГ.

Монарх контролирует архитектуру, repository проекта СГ, роли, capabilities, доступы, конфиги, модули, источники, billing, system diagnostics, безопасность и развитие проекта.

Но контроль системы не означает автоматический свободный просмотр приватной памяти пользователей.

По умолчанию защищены:
- личная память пользователя;
- приватные разговоры;
- документы;
- пользовательские проекты;
- пользовательские repositories;
- личные настройки.

Исключительный доступ возможен только через явную, ограниченную, аудируемую и policy-controlled процедуру.

---

# 4. Identity

## D-004: global_user_id — корень личности

Статус: ПРИНЯТО  
Область: identity / multi-transport

Все персональные данные и права должны идти от `global_user_id`.

Не являются корнем личности:
- Telegram ID;
- Discord ID;
- GitHub ID;
- chat_id;
- platform-specific ID.

Они являются только связями с каналами.

Правильная модель:

```text
platform_user_id -> user_identities -> global_user_id -> Personal SG
```

Если `global_user_id` отсутствует, пользователь работает как guest и не получает чужой project context.

---

# 5. Проекты и рабочие пространства

## D-005: Проект Гарика не является default для всех

Статус: ПРИНЯТО  
Область: multi-project / isolation

`garya-bot` — это проект монарха и внутренний проект разработки СГ.

Он может быть default только для Гарика в приватной работе над СГ.

Обычные пользователи не должны автоматически получать repo Гарика, workflow Гарика, project memory Гарика или development context Гарика.

Если у пользователя нет активного проекта, СГ работает как универсальный помощник.

---

# 6. Workflow как источник смысла

## D-006: Workflow — это не файл и не папка

Статус: ПРИНЯТО  
Область: workflow / sources / provider model

Workflow — это источник смысла о процессе работы.

Он может быть файлом, папкой, базой данных, GitHub source, Notion, Obsidian, внутренним UI, API или любым будущим provider.

Правильная модель:

```text
meaning request -> SourceResolver -> Provider/Adapter -> normalized result
```

СГ не должен жёстко знать, где именно лежит workflow.
Он должен уметь получать workflow через provider/source layer.

---

# 7. Capabilities вместо вечных запретов

## D-007: СГ управляется через capabilities, modes, permissions и confirmations

Статус: ПРИНЯТО  
Область: permissions / actions / control

Capability = способность СГ.  
Mode = уровень свободы.  
Permission = можно ли сейчас.  
Confirmation = нужно ли подтверждение.

Примеры:
- `think` = всегда можно;
- `analyze` = всегда можно;
- `suggest` = всегда можно;
- `prepare_code` = можно как предложение;
- `modify_repo` = только после разрешения;
- `deploy` = только после разрешения;
- `delete_data` = только после разрешения.

Запреты не должны становиться вечными костылями.
Они должны быть выражены через политики, роли, capabilities, confirmations и контекст.

---

# 8. Команды — не сущность СГ

## D-008: Команды — это интерфейсные ярлыки

Статус: ПРИНЯТО  
Область: UX / commands / intent

Команды типа `/pm_set`, `/repo_status`, `/workflow_check`, `/tasks` — это shortcuts.

СГ не должен мыслить так:

```text
нет команды = нет способности
```

Правильная модель:

```text
пользователь говорит естественно
-> СГ понимает intent
-> выбирает capability
-> выбирает source/tool
-> проверяет permission
-> предупреждает о рисках
-> спрашивает разрешение, если действие меняет состояние
-> выполняет разрешённое действие
```

---

# 9. Meaning-first

## D-009: СГ не должен быть trapped by regex

Статус: ПРИНЯТО  
Область: meaning / intent / intelligence

СГ не должен работать по схеме:

```text
keyword -> reflex response
```

Правильная схема:

```text
meaning -> intent -> context -> permission -> source/tool -> action/answer
```

Regex, keywords и phrase signals могут быть только вспомогательными сигналами.
Они не являются интеллектом СГ.

---

# 10. Human Mode, Technical Mode и минимальный semantic routing

## D-010: Semantic routing должен быть минимальным управляющим слоем, а не заменой мышления модели

Статус: ПРИНЯТО  
Область: Human Mode / Technical Mode / semantic routing / AI control

СГ не должен строить тяжёлый Global SemanticRouter как отдельный искусственный мозг, если reasoning model уже способна понимать смысл запроса.

Правильная модель:

```text
reasoning model понимает смысл
-> minimal routing layer проверяет scope / permissions / capability / source / risk
-> СГ выполняет разрешённое действие или отвечает
```

Semantic routing в СГ должен быть минимальным, управляемым и конфигурируемым слоем.

Он нужен не для замены интеллекта модели, а для:
- выбора capability;
- проверки прав;
- выбора источника;
- определения read-only или state-changing действия;
- запроса подтверждения;
- логирования;
- защиты от неправильного действия.

Human Mode — это нормальное естественное общение с СГ по смыслу.
Technical Mode — это команды, диагностика, тесты, legacy routes и debug tools.

Запрещено:
- строить тяжёлый router раньше необходимости;
- дублировать мышление GPT большим количеством кода;
- превращать routing layer в отдельную сущность СГ;
- подменять reasoning model keyword/regex-логикой;
- смешивать Human Mode и Technical Mode;
- выдавать старые regex/phrase routes за Human Mode;
- подключать Human Mode runtime без gate.

Разрешено:
- использовать модель для понимания смысла;
- использовать минимальные structured outputs;
- держать routing layer маленьким;
- управлять поведением через policies, prompts, configs и gates;
- начинать с простого контроллера: user -> meaning -> permission -> capability -> source/action -> response.

Gate обязателен для действий, которые могут менять состояние, трогать repo, писать в память, обращаться к приватным данным, запускать дорогие AI-вызовы или выполнять внешние действия.

Минимальная схема:

```text
User message
-> reasoning model / meaning provider
-> minimal controller
   -> user/scope check
   -> capability check
   -> source/tool check
   -> risk/action type check
   -> confirmation if needed
-> response/action
```

Цель: не заменить GPT кодом, а безопасно направлять способности СГ.

---

# 11. Память

## D-011: Chat History, Memory и Project Memory — разные слои

Статус: ПРИНЯТО  
Область: memory / recall / project context

Chat History = архив сообщений.  
Memory = подтверждённая долговременная семантическая память.  
Project Memory = рабочий контекст конкретного проекта.  
Pillars = каноническая правда проекта.

Запрещено:
- сырой чат считать confirmed memory;
- Project Memory использовать вместо pillars;
- raw repo code хранить как memory;
- смешивать память разных пользователей.

---

# 12. Source-first

## D-012: ИИ не является источником истины

Статус: ПРИНЯТО  
Область: sources / factuality / analysis

СГ должен опираться на реальные источники:
- repo/runtime;
- API;
- RSS;
- web;
- документы;
- базы данных;
- пользовательские источники.

ИИ используется для анализа, объяснения, синтеза, проверки логики и формулирования результата.

ИИ не заменяет источник данных.

---

# 13. AI Routing

## D-013: Все AI-вызовы идут через централизованный router/wrapper

Статус: ПРИНЯТО  
Область: AI calls / cost / observability

Прямые вызовы моделей запрещены.

Каждый AI-вызов должен иметь:
- модель;
- причину;
- cost level;
- токены;
- user/project scope;
- логирование.

AI operator не является СГ.
AI operator — инструмент СГ.

---

# 14. Repo и код

## D-014: Repo/code AI работает в режиме анализа и предложения

Статус: ПРИНЯТО  
Область: repo / code / safety

СГ может читать repo, анализировать код, искать ошибки, готовить план, готовить diff/patch как предложение.

СГ не может без разрешения менять repo, применять patch, делать commit, делать PR, делать deploy или удалять код.

---

# 15. RepoStateAgent

## D-015: RepoStateAgent — источник фактов о repo, но не СГ

Статус: ПРИНЯТО  
Область: repo facts / diagnostics / project state

RepoStateAgent — компонент СГ для наблюдения за состоянием repository.

Он может давать карту проекта, структуру, архитектурное состояние, next action и риски.

Но RepoStateAgent не является СГ, не принимает финальных решений, не меняет код и не заменяет монарха.

---

# 16. Agents

## D-016: Агенты — инструменты СГ

Статус: ПРИНЯТО  
Область: agents / orchestration / identity

Агенты могут выполнять отдельные задачи: repo analysis, diagnostics, sources, memory, code proposals, documents, research, automation.

Но агент не является отдельным СГ.
Агент не владеет решениями, памятью, архитектурой или идентичностью СГ.

---

# 17. Privacy и user isolation

## D-017: Изоляция пользователей важнее удобства

Статус: ПРИНЯТО  
Область: privacy / multiuser / memory isolation

Память, проекты, repositories, источники и настройки пользователей не смешиваются.

По умолчанию:
- User A не видит User B;
- User A не получает память User B;
- User A не получает project context User B;
- User A не получает repo User B.

Любой cross-user доступ должен быть явным, ограниченным, разрешённым и логируемым.

---

# 18. Группы

## D-018: В группе СГ наблюдает, но не вмешивается без причины

Статус: ПРИНЯТО  
Область: groups / moderation / memory

Режимы группы:
- observer;
- assistant;
- moderator;
- sandbox.

По умолчанию:
- СГ читает контекст;
- отвечает только при обращении, reply, команде или разрешённом nudge;
- не смешивает персональные памяти участников;
- group memory отделена от personal memory.

---

# 19. Governance

## D-019: Архитектура меняется только после решения монарха

Статус: ПРИНЯТО  
Область: governance / architecture / decisions

Любое изменение сущности СГ, pillars, accepted decisions, governance, permissions, Human/Technical boundary, source-of-truth policy, memory policy или repo/code authority требует явного решения монарха.

---

# 20. Stage gates

## D-020: Stage gates ограничивают внедрение, но не мышление

Статус: ПРИНЯТО  
Область: roadmap / implementation order

СГ может думать о будущих этапах, предлагать будущую архитектуру и предупреждать о рисках.

Но внедрять будущие функции раньше stage gate нельзя без решения монарха.

---

# 21. Миграция старых решений и остальных pillars

## D-021: Остальные pillars должны быть приведены к DECISIONS.md

Статус: ПРИНЯТО  
Область: migration / docs governance / source hierarchy

Этот файл является новой верхней философской и архитектурной основой СГ.

Все остальные files under `pillars/` должны быть пересмотрены и приведены в соответствие с этим `DECISIONS.md`.

Особенно пересмотру подлежат:
- `pillars/SG_ENTITY.md`;
- `pillars/PROJECT.md`;
- `pillars/SG_BEHAVIOR.md`;
- `pillars/README.md`;
- `pillars/DOCS_GOVERNANCE.md`;
- `pillars/architecture/SEMANTIC_ROUTING.md`;
- `pillars/architecture/SG_INTERFACE_LAYERS.md`;
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`;
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`;
- `pillars/architecture/MODULE_MAP.md`;
- `pillars/architecture/DATA_FLOW.md`;
- `pillars/architecture/PERMISSIONS_MAP.md`;
- `pillars/workflow/*`;
- `pillars/modules/*`.

Миграция должна идти по порядку:
1. сначала root-философия;
2. затем architecture boundaries;
3. затем workflow;
4. затем module docs;
5. затем code/runtime при необходимости.

Нельзя менять всё хаотично.
Нельзя сохранять старые pillar-формулировки, если они противоречат новой философии СГ.
