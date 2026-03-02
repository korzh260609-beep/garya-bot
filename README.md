# SG (Советник GARYA)

[![SG Minimal CI](https://github.com/korzh260609-beep/garya-bot/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/korzh260609-beep/garya-bot/actions/workflows/ci.yml)

SG (Советник GARYA) — модульный универсальный AI-ассистент и Task Engine-система, построенная по принципу identity-first архитектуры и строгой этапной разработки.

SG проектируется как мультиплатформенная decision-support система.  
Telegram на текущем этапе используется как transport layer, а не как основа архитектуры.

---

## 🚀 Запуск

### Требования

- Node.js 18+
- PostgreSQL (локальный или облачный, например Render / Supabase)
- Telegram Bot Token (получить у [@BotFather](https://t.me/BotFather))

### Шаги

1. **Клонировать репозиторий**

   ```bash
   git clone https://github.com/korzh260609-beep/garya-bot.git
   cd garya-bot
   ```

2. **Установить зависимости**

   ```bash
   npm install
   ```

3. **Настроить переменные окружения**

   ```bash
   cp .env.example .env
   ```

   Заполнить `.env`:

   ```
   BOT_TOKEN=<токен бота от @BotFather>
   DATABASE_URL=<строка подключения к PostgreSQL>
   MONARCH_USER_ID=<ваш Telegram user_id>
   ```

4. **Применить миграции базы данных**

   ```bash
   npm run migrate:up
   ```

5. **Запустить бота**

   ```bash
   npm start
   ```

---

## 🏗 Архитектура

- Node.js (ESM)
- Express — HTTP / Webhook
- PostgreSQL — память, задачи, access-requests
- Telegram — текущий транспорт
- Render — хостинг
- GitHub Actions — CI
- Модульная AI-интеграция

---

## 🔑 Ключевые принципы

- Identity-first (монарх определяется только через `process.env.MONARCH_USER_ID`)
- Никакого доверия к `chat_id`
- `senderIdStr (msg.from.id)` — source of truth
- Жёсткое разделение слоёв (Transport / Core / Sources / AI)
- Source-first подход
- Строгая этапность (ROADMAP + WORKFLOW)
- 1 шаг = 1 действие
- Никакой автодеплой без контроля монарха
- DEV-GATE: административные команды работают только в личном чате монарха

---

## ⚙ Основные модули

### 🧠 Core / Task Engine

- Создание задач
- Запуск через AI
- Статусы: active / paused / deleted
- Планирование
- Подготовка к масштабированию (JobRunner skeleton)

Команды:

/tasks  
/newtask <title> | <note>  
/run <id>  
/stop_tasks_type  

---

### 🌐 Sources Layer

Унифицированная система подключения источников данных.

Команды:

/sources  
/sources_diag  
/source <key>  
/diag_source <key>  

---

### 📂 GitHub Integration (Read-only)

Интеграция с репозиторием:

/reindex  
/repo_tree  
/repo_status  
/repo_search  
/repo_analyze  
/repo_review  
/repo_diff  

Поддерживается snapshot-индексация и безопасный анализ файлов.  
Запись кода по умолчанию отключена (manual apply only).

---

### 🔐 Identity & Access

Монарх определяется строго через ENV:

MONARCH_USER_ID

Access-request workflow:

/approve <id>  
/deny <id>  
/ar_list  
/ar_create_test  

Административные команды защищены:
- доступны только монарху (роль monarch + permissions.can())
- guest получает access request
- `cmd.admin.*` запрещены всем кроме монарха
- DEV-GATE: выполняются только в личном чате монарха

Identity логика не зависит от transport (группа/личка/будущие каналы).

---

## 🚦 Rate Limit

Для non-monarch команд используется in-memory rate limit.

ENV:

CMD_RL_WINDOW_MS=20000  
CMD_RL_MAX=6  

Монарх (роль monarch) не ограничивается rate-limit.

---

## 🔐 Environment Variables

Файл `.env.example` находится в корне репозитория и содержит шаблон переменных.

Обязательные:

BOT_TOKEN=  
DATABASE_URL=  
MONARCH_USER_ID=  

Опциональные:

CMD_RL_WINDOW_MS=20000  
CMD_RL_MAX=6  
NODE_ENV=production  
PORT=3000  

Файл `.env` не коммитится.

---

## 🚀 CI

GitHub Actions workflow:

- Установка зависимостей
- Проверка синтаксиса (`node --check`)
- Автозапуск при push в `main`

CI защищает проект от синтаксических ошибок.

---

## 📌 Статус проекта

Stage-based архитектурная разработка.  
Transport может быть заменён без изменения Core.

---

## 👑 Автор

Monarch: GARYA

---

SG — это управляемая архитектурная система с контролируемой эволюцией.
