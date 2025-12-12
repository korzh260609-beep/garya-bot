// src/tasks/taskEngine.js — Task Engine + Access Rules (7.10)
import pool from "../../db.js";
import { callAI } from "../../ai.js";

// ==================================================
// === ACCESS RULES (7.10)
// ==================================================
function canAccessTask({
  userRole,
  userPlan,
  taskType,
  action,
  isOwner,
  bypassPermissions,
}) {
  if (bypassPermissions) return true;

  // Базовые правила
  if (!isOwner) return false;

  // Гости — только простые задачи
  if (userRole === "guest") {
    if (taskType === "price_monitor") return false;
    if (action === "run") return true;
    if (action === "create") return true;
    if (action === "stop") return true;
  }

  // citizen / vip — позже расширим
  return true;
}

// ==================================================
// === CREATE TASKS
// ==================================================

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
    [userChatId, "Демо-задача", "demo", payload, null, "active"]
  );

  return result.rows[0].id;
}

// manual-задача
export async function createManualTask(
  userChatId,
  title,
  note,
  access = {}
) {
  const allowed = canAccessTask({
    userRole: access.userRole || "guest",
    userPlan: access.userPlan || "free",
    taskType: "manual",
    action: "create",
    isOwner: true,
    bypassPermissions: access.bypassPermissions === true,
  });

  if (!allowed) {
    throw new Error("Доступ к созданию задачи запрещён");
  }

  const payload = { note };

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

// тестовый price_monitor
export async function createTestPriceMonitorTask(
  userChatId,
  access = {}
) {
  const allowed = canAccessTask({
    userRole: access.userRole || "guest",
    userPlan: access.userPlan || "free",
    taskType: "price_monitor",
    action: "create",
    isOwner: true,
    bypassPermissions: access.bypassPermissions === true,
  });

  if (!allowed) {
    throw new Error("Доступ к созданию price_monitor запрещён");
  }

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
    [
      userChatId,
      "Тестовый price_monitor для BTC",
      "price_monitor",
      payload,
      null,
      "active",
    ]
  );

  return result.rows[0].id;
}

// ==================================================
// === READ TASKS
// ==================================================
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

// ==================================================
// === UPDATE STATUS
// ==================================================
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

// ==================================================
// === RUN TASK WITH AI (ACCESS-AWARE)
// ==================================================
export async function runTaskWithAI(
  task,
  chatId,
  bot,
  access = {}
) {
  const allowed = canAccessTask({
    userRole: access.userRole || "guest",
    userPlan: access.userPlan || "free",
    taskType: task.type,
    action: "run",
    isOwner: task.user_chat_id === chatId,
    bypassPermissions: access.bypassPermissions === true,
  });

  if (!allowed) {
    await bot.sendMessage(chatId, "⛔ Доступ к выполнению задачи запрещён");
    return;
  }

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
Твоя цель — буквально и полезно ВЫПОЛНИТЬ её в пределах текста.
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

Описание:
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
    reply = "⚠️ ИИ временно недоступен.";
  }

  await pool.query("UPDATE tasks SET last_run = NOW() WHERE id = $1", [
    task.id,
  ]);

  await bot.sendMessage(
    chatId,
    `🚀 Задача #${task.id} выполнена ИИ-движком.\n\n${reply}`
  );
}
