# LIVING_SG_BOUNDARY.md

Дата: 2026-04-30  
Статус: ARCHITECTURE BOUNDARY / NO RUNTIME CHANGES  
Владелец решения: Монарх Gary  
Основание: `pillars/DECISIONS.md`

---

# 0. Цель

Этот документ фиксирует границу между новым Living SG и старым Technical Mode.

Главная цель:

```text
не развивать Technical Mode,
а изолировать его,
чтобы он не мешал созданию живого СГ.
```

---

# 1. Главная формула

```text
Living SG = верхний смысловой слой СГ.
Technical Mode = изолированный старый технический слой.
```

Living SG должен работать через:

```text
user message
-> meaning
-> intent
-> capability plan
-> permission / scope
-> risk
-> confirmation if needed
-> response or approved action
```

Technical Mode должен оставаться сбоку:

```text
explicit technical access
-> legacy command / diagnostic / debug / maintenance route
```

---

# 2. Запреты

Запрещено добавлять новые slash-команды как путь развития СГ.

Запрещено:

```text
natural user text -> command lookup -> execute command
natural user text -> diagnostic bridge -> technical handler
regex/keyword -> technical action
project phrase -> repo diagnostic route
```

Запрещено развивать Technical Mode как основной интерфейс.

Запрещено считать:

```text
slash command = capability
technical route = Living SG
projectIntent legacy route = Human Mode
```

---

# 3. Разрешено

Разрешено изолировать Technical Mode.

Разрешено:

```text
- переносить legacy/projectIntent/diagnostic bridges за отдельную boundary-грань;
- маркировать technical routes как legacy/technical-only;
- делать адаптеры, которые не участвуют в обычном Living SG path;
- создавать Living SG слой выше старого runtime;
- сохранять старые команды только для ремонта/обслуживания, не для развития UX.
```

---

# 4. Текущее смешение, которое нужно устранить

Главный смешанный участок сейчас:

```text
src/core/handleMessage/handleChatFlow.js
```

Внутри обычного chat flow всё ещё находятся:

```text
resolveProjectIntentRoute
requireProjectIntentAccess
maybeHandleProjectDiagnosticNaturalBridge
runProjectIntentConversationFlow
ProjectMemoryAutoCapture
PendingProjectActionStore
```

Проблема:

```text
обычное живое общение всё ещё может проходить через старые projectIntent/diagnostic/repo bridges.
```

Это не развитие Living SG. Это переходный runtime, который нужно разделить.

---

# 5. Целевая структура

Целевая архитектура:

```text
src/core/living-sg/
  LivingSGBoundary.js
  LivingRequest.js
  LivingIntentPlan.js
  LivingCapabilityPlan.js
  LivingActionGate.js
  LivingResponsePlan.js

src/core/technical-mode/
  TechnicalModeBoundary.js
  legacyProjectIntentAdapter.js
  legacyCommandAdapter.js
```

Важно:

```text
technical-mode/ не должен становиться новым центром проекта.
Он нужен только как quarantine/adaptor для старого слоя.
```

---

# 6. Living SG Boundary

Living SG Boundary отвечает за нормальный пользовательский путь:

```text
message
-> user identity / scope
-> personal/project context
-> meaning
-> capability plan
-> read-only answer OR approval request
```

Living SG может:

```text
думать
анализировать
задавать уточнение
объяснять
предлагать план
готовить проект решения
готовить patch как предложение
```

Living SG не может без разрешения:

```text
менять repo
делать commit
делать deploy
писать в confirmed memory
удалять данные
выполнять внешние действия
```

---

# 7. Technical Mode Boundary

Technical Mode Boundary отвечает только за старое техническое обслуживание:

```text
commands
debug
diagnostics
legacy routes
repo maintenance
migration utilities
```

Technical Mode не должен перехватывать обычный пользовательский текст.

Technical Mode не должен расширяться новыми командами без отдельного решения монарха.

---

# 8. Что делать с projectIntent

`projectIntent` не удалять резко.

Правильная миграция:

```text
1. пометить projectIntent как legacy/technical adapter;
2. убрать diagnostic natural bridge из обычного Living SG path;
3. оставить projectIntent доступным только через Technical Mode Boundary или временный adapter;
4. постепенно заменить его Living SG capability plan.
```

---

# 9. Что делать с MeaningEngine

Текущий `MeaningEngine` — переходный слой.

Он может временно помогать, но не должен стать финальным мозгом СГ.

Проблема:

```text
часть meaning сейчас построена на regex/keywords.
```

Цель:

```text
reasoning model / structured meaning
+ minimal controller
+ capability/risk gate
```

---

# 10. Первый безопасный runtime-порядок

Не делать сразу большой рефакторинг.

Порядок:

```text
1. создать Living SG skeleton без подключения;
2. создать Technical Mode Boundary skeleton без новых команд;
3. перенести projectIntent imports за legacy adapter;
4. в handleChatFlow оставить только вызов boundary;
5. отключить natural diagnostic bridge из обычного chat path;
6. проверить CI;
7. деплой;
8. проверить обычный ответ СГ.
```

---

# 11. Что считается успехом

Успех первого этапа:

```text
handleChatFlow больше не содержит прямых technical/projectIntent bridge imports.
Living SG имеет отдельную boundary-точку.
Technical Mode находится в quarantine/adapters.
Новых slash-команд нет.
Поведение пользователя не ломается.
```

---

# 12. Короткий вывод

```text
Technical Mode не развиваем.
Technical Mode изолируем.
Living SG строим сверху.
Старые команды и bridges не должны определять мышление СГ.
```
