import pool from "../db.js";
import { callAI } from "../ai.js";

// === ФУНКЦИИ ДЛЯ TASK ENGINE ===

// демо-задача
export async function createDemoTask(userChatId) {
  const payload = {
    note: "Это демо-задача. В будущем здесь будут параметры отчёта/мониторинга.",
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      userChatId,
      "Демо-задача",
      "demo",
      payload,
      null,
      "active", // или "pending"
    ]
  );

  return result.rows[0].id;
}

// создаём manual-задачу по тексту пользователя
export async function createManualTask(userChatId, title, note) {
  const payload = {
    note,
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `,
    [userChatId, title, "manual", payload, null, "active"]
  );

  return result.rows[0];
}

// создаём тестовую задачу price_monitor для BTC (для проверки ROBOT-слоя)
export async function createTestPriceMonitorTask(userChatId) {
  const payload = {
    symbol: "BTCUSDT",
    interval_minutes: 60,
    threshold_percent: 2,
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [userChatId, "Тестовый price_monitor для BTC", "price_monitor", payload, null, "active"]
  );

  return result.rows[0].id;
}

// получаем задачи пользователя
export async function getUserTasks(userChatId, limit = 20) {
  const result = await pool.query(
    `
      SELECT id, title, type, status, created_at, last_run
      FROM tasks
      WHERE user_chat_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userChatId, limit]
  );
  return result.rows;
}

// получаем задачу по id для конкретного пользователя
export async function getTaskById(userChatId, taskId) {
  const result = await pool.query(
    `
      SELECT id, user_chat_id, title, type, status, payload, schedule, last_run, created_at
      FROM tasks
      WHERE user_chat_id = $1 AND id = $2
      LIMIT 1
    `,
    [userChatId, taskId]
  );

  return result.rows[0] || null;
}

// обновляем статус задачи
export async function updateTaskStatus(taskId, newStatus) {
  await pool.query(
    `
      UPDATE tasks
      SET status = $1
      WHERE id = $2
    `,
    [newStatus, taskId]
  );
}

// ИИ-исполнение задачи (внутренний helper для будущего воркера/команды)
export async function runTaskWithAI(task, chatId, bot) {
  if (!process.env.OPENAI_API_KEY) {
    await bot.sendMessage(
      chatId,
      "Задача есть, но ИИ сейчас недоступен (нет API ключа)."
    );
    return;
  }

  const promptText =
    (task.payload && (task.payload.prompt || task.payload.note)) ||
    task.title ||
    "";

  const messages = [
    {
      role: "system",
      content: `
Ты — ИИ-исполнитель задач Советника GARYA.

Тебе приходит задача из внутреннего Task Engine.
У задачи есть:
- title (краткое имя),
- type (тип задачи),
- payload (JSON с деталями),
- note/prompt (текст с описанием),

Твоя цель — максимально буквально и полезно ВЫПОЛНИТЬ её в пределах текста.

Если задача про отчёт — делай отчёт по формату.
Если задача про анализ — делай анализ.
Если задача про подготовку черновика — готовь черновик.

Если задача требует реальных действий во внешнем мире (доступ к API, блокчейнам и т.д.), ты:
1) Прописываешь, КАК это нужно сделать шаг за шагом.
2) Формируешь текст результата "как если бы" всё уже было сделано.
      `.trim(),
    },
    {
      role: "user",
      content: `
Задача:
- ID: ${task.id}
- Тип: ${task.type}
- Заголовок: ${task.title}

payload (JSON):
${JSON.stringify(task.payload, null, 2)}

Описание / note:
${promptText}
      `.trim(),
    },
  ];

  let reply = "";

  try {
    reply = await callAI(messages, {
      max_output_tokens: 900,
      temperature: 0.3,
    });
  } catch (e) {
    console.error("❌ AI error:", e);
    reply =
      "⚠️ ИИ временно недоступен — произошла ошибка при вызове модели.";
  }

  await pool.query("UPDATE tasks SET last_run = NOW() WHERE id = $1", [
    task.id,
  ]);

  await bot.sendMessage(
    chatId,
    `🚀 Задача #${task.id} выполнена ИИ-движком.\n\n${reply}`
  );
}

