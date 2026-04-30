# HANDLE_CHAT_FLOW_ISOLATION_PLAN.md

Дата: 2026-04-30  
Статус: ARCHITECTURE PLAN / NO RUNTIME CHANGES  
Владелец решения: Монарх Gary  
Основание:
- `pillars/DECISIONS.md`
- `pillars/architecture/LIVING_SG_BOUNDARY.md`

---

# 0. Цель

Цель этого плана — безопасно разделить обычный Living SG path и старую legacy/projectIntent/diagnostic-логику внутри:

```text
src/core/handleMessage/handleChatFlow.js
```

Главное правило:

```text
не создавать новый Technical Mode,
не добавлять slash-команды,
не добавлять diagnostic bridges,
а изолировать уже существующие legacy-механизмы от обычного живого общения.
```

---

# 1. Текущее состояние

`handleChatFlow.js` сейчас выполняет сразу несколько ответственностей:

```text
1. pending project action confirmation;
2. saveMessageToMemory / saveChatPair helpers;
3. projectIntent follow-up context;
4. projectIntent pending choice context;
5. projectIntent routing text;
6. project context decision;
7. ProjectMemoryAutoCapture dry-run;
8. projectIntent route;
9. projectIntent access guard;
10. diagnostic natural bridge;
11. explicit remember;
12. inbound chat storage/dedupe;
13. projectIntent conversation flow;
14. internal project fallback;
15. generic chat handler call.
```

Проблема:

```text
обычный пользовательский chat path смешан с repo/projectIntent/diagnostic legacy routes.
```

---

# 2. Что должно остаться в обычном Living SG path

В нормальном Living SG path должны остаться только безопасные общие части:

```text
- подготовка request/context;
- обычное сохранение входящего сообщения;
- explicit remember как отдельный memory flow, не projectIntent;
- вызов обычного chat handler;
- будущий вызов LivingSGBoundary;
- read-only response planning;
- confirmation request for state-changing actions.
```

Важно:

```text
Living SG path не должен напрямую вызывать projectIntent route, diagnostic bridge или repo conversation flow.
```

---

# 3. Что нужно вынести за legacy/project boundary

Следующие части должны быть вынесены из обычного chat path в отдельную legacy/project boundary:

```text
getLatestProjectIntentRepoContext
getLatestProjectIntentPendingChoice
buildProjectIntentRoutingText
ProjectContextEngine для projectIntentRoutingText
ProjectMemoryAutoCapture для projectIntentRoutingText
resolveProjectIntentRoute
requireProjectIntentAccess
maybeHandleProjectDiagnosticNaturalBridge
runProjectIntentConversationFlow
internal project fallback через projectIntentRoute.targetScope
repo_context memory marker write
```

Эта boundary не должна называться новым Technical Mode.

Допустимые названия:

```text
src/core/projectIntent/legacyProjectIntentBoundary.js
src/core/handleMessage/legacyProjectIntentFlow.js
```

Предпочтительный вариант:

```text
src/core/handleMessage/legacyProjectIntentFlow.js
```

Причина:

```text
это изоляция старого поведения внутри handleMessage layer,
а не развитие projectIntent и не создание нового Technical Mode.
```

---

# 4. Что отключать первым

Первым кандидатом на изоляцию является:

```text
maybeHandleProjectDiagnosticNaturalBridge
```

Причина:

```text
natural user text -> diagnostic bridge -> technical handler
```

прямо запрещено в `LIVING_SG_BOUNDARY.md`.

Первое безопасное действие:

```text
убрать diagnostic natural bridge из обычного chat path
и оставить его доступным только через существующие явные technical/legacy routes, если они уже есть.
```

Запрещено при этом:

```text
- создавать новую diagnostic command;
- создавать новый diagnostic bridge;
- переносить diagnostic bridge в новый Technical Mode слой;
- добавлять новый runtime entrypoint.
```

---

# 5. Минимальная safe migration sequence

## Шаг 1 — docs-only plan

Создать этот документ.

Статус: текущий шаг.

Runtime не менять.

## Шаг 2 — legacyProjectIntentFlow skeleton

Создать:

```text
src/core/handleMessage/legacyProjectIntentFlow.js
```

Он должен содержать функцию:

```text
handleLegacyProjectIntentFlow(input)
```

Скелет должен быть read-only по структуре и повторять существующее поведение только после переноса.

На первом коммите можно добавить файл без подключения.

## Шаг 3 — move without behavior change

Перенести legacy/projectIntent блок из `handleChatFlow.js` в `legacyProjectIntentFlow.js` без изменения логики.

Цель:

```text
уменьшить смешение файла,
но сохранить поведение.
```

Проверить:

```text
- нет новых команд;
- нет новой diagnostic bridge;
- нет нового technical-mode folder;
- обычный chat fallback работает как раньше;
- projectIntent legacy поведение не усилилось.
```

## Шаг 4 — disable natural diagnostic bridge in normal chat path

После успешного переноса отключить:

```text
maybeHandleProjectDiagnosticNaturalBridge
```

из normal chat path.

Допустимые варианты:

```text
- удалить вызов из legacyProjectIntentFlow;
- или gated-block: allowDiagnosticNaturalBridge === true, default false.
```

Предпочтительный вариант:

```text
default false через явный internal flag, без пользовательской команды.
```

## Шаг 5 — connect LivingSGBoundary shadow-only

Подключить `createLivingSGBoundary` в shadow-only режиме:

```text
- строить план;
- логировать в trace только при включённом trace;
- не менять ответ;
- не выполнять tools;
- не писать confirmed memory.
```

## Шаг 6 — switch normal chat to Living SG planning

Только после проверки shadow-only:

```text
normal chat -> LivingSGBoundary -> deps.handleChatMessage
legacy projectIntent -> explicit legacy boundary only
```

---

# 6. Риск-карта

## Риск 1 — сломать обычный chat

Причина:

```text
handleChatFlow сейчас одновременно отвечает за storage, memory helpers и fallback.
```

Снижение риска:

```text
сначала вынести только projectIntent block,
не трогать saveMessageToMemory/saveChatPair/inbound storage.
```

## Риск 2 — потерять repo follow-up context

Причина:

```text
repoFollowupContext сейчас передаётся в buildChatHandlerContext как projectIntentRepoContext.
```

Снижение риска:

```text
на первом runtime-шаге сохранить передачу projectIntentRepoContext,
но получать её через legacy boundary result.
```

## Риск 3 — случайно расширить Technical Mode

Причина:

```text
изолируя старое, можно по ошибке создать новый technical layer.
```

Снижение риска:

```text
не создавать src/core/technical-mode/;
не создавать команды;
не создавать diagnostic entrypoints;
названия файлов держать как legacy/isolation, не technical-mode.
```

## Риск 4 — auto-capture останется привязанным к projectIntentRoutingText

Причина:

```text
ProjectMemoryAutoCapture сейчас использует routing text, который может включать follow-up context.
```

Снижение риска:

```text
сначала перенести как есть,
позже заменить на Living SG memory proposal через LivingCapabilityPlan.
```

---

# 7. Минимальный критерий успеха первого runtime-шага

Успех первого runtime-шага:

```text
handleChatFlow.js больше не импортирует напрямую:
- resolveProjectIntentRoute
- requireProjectIntentAccess
- maybeHandleProjectDiagnosticNaturalBridge
- runProjectIntentConversationFlow
```

При этом:

```text
- пользовательский ответ не ломается;
- новых slash-команд нет;
- Technical Mode не расширен;
- diagnostic natural bridge не усилился;
- legacy поведение изолировано за одной функцией.
```

---

# 8. Запрещённые решения

Запрещено:

```text
- создавать src/core/technical-mode/;
- создавать новые slash-команды;
- создавать новые diagnostic commands;
- создавать новый diagnostic natural bridge;
- делать projectIntent основой Living SG;
- удалять projectIntent резко без переходного слоя;
- менять CHANGELOG без отдельного разрешения;
- делать deploy без проверки и rollback point.
```

---

# 9. Следующий шаг после этого документа

Следующий разрешённый технический шаг:

```text
создать disconnected skeleton файла:
src/core/handleMessage/legacyProjectIntentFlow.js
```

Пока без подключения.

После этого можно готовить минимальный перенос блока из `handleChatFlow.js` без изменения поведения.
