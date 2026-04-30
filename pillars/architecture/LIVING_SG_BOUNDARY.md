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
не создавать новый Technical Mode слой,
а изолировать уже существующую техническую/legacy-логику,
чтобы она не мешала созданию живого СГ.
```

---

# 1. Главная формула

```text
Living SG = верхний смысловой слой СГ.
Technical Mode = уже существующий старый технический слой, который нужно изолировать.
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

Technical Mode не является направлением развития.
Он остаётся только как существующий служебный/legacy слой для ремонта, обслуживания и совместимости.

---

# 2. Запреты

Запрещено добавлять новые slash-команды как путь развития СГ.

Запрещено создавать новые сущности Technical Mode без отдельного решения монарха.

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

Разрешено изолировать уже существующий Technical Mode.

Разрешено:

```text
- убрать смешение legacy/projectIntent/diagnostic bridges с обычным Living SG path;
- маркировать существующие technical routes как legacy/technical-only;
- переносить вызовы старой technical-логики за границу Living SG;
- создавать Living SG слой выше старого runtime;
- сохранять старые команды только для ремонта/обслуживания, не для развития UX.
```

Не разрешено:

```text
- создавать новый технический слой как отдельное направление разработки;
- добавлять новые команды;
- добавлять новые diagnostic bridges;
- делать Technical Mode центром проекта.
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

Целевая архитектура для нового слоя:

```text
src/core/living-sg/
  LivingSGBoundary.js
  LivingRequest.js
  LivingIntentPlan.js
  LivingCapabilityPlan.js
  LivingActionGate.js
  LivingResponsePlan.js
```

Важно:

```text
новую папку/слой Technical Mode не создавать.
Существующую technical/legacy-логику не развивать.
Её нужно только изолировать от Living SG path.
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

# 7. Existing Technical Mode Boundary

Technical Mode уже существует в старом runtime:

```text
commands
debug
diagnostics
legacy routes
repo maintenance
migration utilities
```

Его задача теперь — не развиваться, а быть изолированным от Living SG.

Technical Mode не должен перехватывать обычный пользовательский текст.

Technical Mode не должен расширяться новыми командами без отдельного решения монарха.

---

# 8. Что делать с projectIntent

`projectIntent` не удалять резко.

Правильная миграция:

```text
1. признать projectIntent переходным legacy-мостом;
2. убрать diagnostic natural bridge из обычного Living SG path;
3. не создавать новый Technical Mode слой ради projectIntent;
4. постепенно заменить projectIntent живым Living SG capability plan.
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
2. не создавать новый Technical Mode skeleton;
3. убрать прямое смешение projectIntent/diagnostic bridge с обычным chat flow;
4. в handleChatFlow оставить чистый Living SG path;
5. отключить natural diagnostic bridge из обычного chat path;
6. проверить CI;
7. деплой;
8. проверить обычный ответ СГ.
```

---

# 11. Что считается успехом

Успех первого этапа:

```text
handleChatFlow больше не смешивает обычный Living SG path с diagnostic/projectIntent bridges.
Living SG имеет отдельную boundary-точку.
Существующий Technical Mode не расширяется.
Новых slash-команд нет.
Поведение пользователя не ломается.
```

---

# 12. Короткий вывод

```text
Technical Mode не развиваем.
Новый технический слой не создаём.
Существующее техническое изолируем.
Living SG строим сверху.
Старые команды и bridges не должны определять мышление СГ.
```
