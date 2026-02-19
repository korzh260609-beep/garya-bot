// src/tasks/taskEngine.js — Task Engine + Access Rules (7.10)
import pool from "../../db.js";
import { callAI } from "../../ai.js";
import { can } from "../users/permissions.js";

// ==================================================
// === TASK ACCESS (7.10) via Permissions-layer ===
// ==================================================
function buildUser(access = {}) {
  return {
    role: (access.userRole || "guest").toLowerCase(),
    plan: (access.userPlan || "free").toLowerCase(),
    global_user_id: access?.user?.global_user_id || null,
  };
}

function normalizeId(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

/**
 * Identity-first ownership:
 * ONLY task.user_global_id vs access.user.global_user_id
 */
function isOwnerOfTask(task, chatId, access = {}) {
  const taskGlobal = normalizeId(task?.user_global_id);
  const userGlobal = normalizeId(access?.user?.global_user_id);

  if (taskGlobal && userGlobal) return taskGlobal === userGlobal;
  return false;
}

function canTask(user, action, ctx = {}) {
  // 1) базовая проверка can() (для будущего расширения)
  // 2) текущие правила V1 (сохранены)
  if (can(user, action, ctx)) return true;

  // Если can() в будущем станет строгим — ниже останутся V1-правила как страховка.
  // Сейчас can() для roles != guest возвращает true, а guest-правила на команды уже в permissions.js.
  return false;
}

// ВАЖНО: task:* правила пока держим здесь (7.10), не в permissions.js,
// чтобы не смешивать command-level и task-level в одном месте на раннем этапе.
function applyTaskV1Rules({ user, taskType, action, isOwner }) {
  // ✅ Monarch override (без bypassPermissions)
  if (user.role === "monarch") return true;

  // Базовое правило: только владелец
  if (!isOwner) return false;

  // Гость: запрет на price_monitor
  if (user.role === "guest") {
    if (taskType === "price_monitor") return false;

    // Разрешённые действия гостя для простых задач
    if (action === "task:create") return true;
    if (action === "task:run") return true;
    if (action === "task:stop") return true;
    if (action === "task:list") return true;
    return false;
  }

  // citizen/vip — позже ужесточим/расширим
  return true;
}

function assertTaskAccess({ access, taskType, action, isOwner }) {
  const user = buildUser(access);

  // 1) V1 правила (как сейчас задумано)
  const allowedV1 = applyTaskV1Rules({
    user,
    taskType,
    action,
    isOwner,
  });

  if (!allowedV1) return { ok: false, user };

  // 2) Permissions-layer hook (на будущее): если потребуется, можно будет включить строгие правила
  // Сейчас can() гостя по task:* не разрешает/не запрещает — потому мы опираемся на V1-правила.
  const allowedCan = canTask(user, action, { taskType });

  // Сейчас allowedCan для guest обычно false (в permissions.js этого нет),
  // поэтому НЕ блокируем, чтобы не сломать текущую логику.
  // Когда перенесём task:* в permissions.js — переключим на строгий режим.
  return { ok: true, user, allowedCan };
}

// ==================================================
// === CREATE TASKS (identity-first ONLY)
// ==================================================

function requireUserGlobalId(access = {}) {
  const userGlobalId = normalizeId(access?.user?.global_user_id);
  if (!userGlobalId) {
    // безопасно: без global_user_id задачи не должны создаваться (identity-only)
    throw new Error("Identity error: global_user_id missing");
  }
  return userGlobalId;
}

// демо-задача
export async function createDemoTask(userChatId, access = {}) {
  const payload = {
    note: "Это демо-задача. В будущем здесь будут параметры отчёта/мониторинга.",
  };

  const userGlobalId = requireUserGlobalId(access);

  const result = await pool.query(
    `
      INSERT INTO tasks (user_global_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [userGlobalId, "Демо-задача", "demo", payload, null, "active"]
  );

  return result.rows[0].id;
}

// manual-задача
export async function createManualTask(userChatId, title, note, access = {}) {
  const check = assertTaskAccess({
    access,
    taskType: "manual",
    action: "task:create",
    isOwner: true,
  });

  if (!check.ok) {
    throw new Error("Доступ к созданию задачи запрещён");
  }

  const payload = { note };
  const userGlobalId = requireUserGlobalId(access);

  const result = await pool.query(
    `
      INSERT INTO tasks (user_global_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `,
    [userGlobalId, title, "manual", payload, null, "active"]
  );

  return result.rows[0];
}

// тестовый price_monitor
export async function createTestPriceMonitorTask(userChatId, access = {}) {
  const check = assertTaskAccess({
    access,
    taskType: "price_monitor",
    action: "task:create",
    isOwner: true,
  });

  if (!check.ok) {
    throw new Error("Доступ к созданию price_monitor запрещён");
  }

  const payload = {
    symbol: "BTCUSDT",
    interval_minutes: 1,
    threshold_percent: 1,
  };

  const userGlobalId = requireUserGlobalId(access);

  const result = await pool.query(
    `
      INSERT INTO tasks (user_global_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      userGlobalId,
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
// === READ TASKS (identity-first ONLY)
// ==================================================
export async function getUserTasks(userChatId, limit = 20, access = {}) {
  // list — тоже действие (на будущее, сейчас не ломаем)
  const check = assertTaskAccess({
    access,
    taskType: "any",
    action: "task:list",
    isOwner: true,
  });

  if (!check.ok) {
    // безопасный дефолт — пустой список
    return [];
  }

  const userGlobalId = normalizeId(access?.user?.global_user_id);
  if (!userGlobalId) return [];

  const result = await pool.query(
    `
      SELECT id, title, type, status, created_at, last_run
      FROM tasks
      WHERE user_global_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userGlobalId, limit]
  );

  return result.rows;
}

export async function getTaskById(userChatId, taskId, access = {}) {
  const userGlobalId = normalizeId(access?.user?.global_user_id);
  if (!userGlobalId) return null;

  const result = await pool.query(
    `
      SELECT id, user_global_id, title, type, status, payload, schedule, last_run, created_at
      FROM tasks
      WHERE id = $2 AND user_global_id = $1
      LIMIT 1
    `,
    [userGlobalId, taskId]
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
// === RUN TASK WITH AI (ACCESS-AWARE, identity-first owner)
// ==================================================
export async function runTaskWithAI(task, chatId, bot, access = {}) {
  const check = assertTaskAccess({
    access,
    taskType: task.type,
    action: "task:run",
    isOwner: isOwnerOfTask(task, chatId, access),
  });

  if (!check.ok) {
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
    // ВНИМАНИЕ: твой callAI в проекте уже обёрнут; оставляю текущий вызов как был,
    // чтобы ничего не сломать по сигнатуре.
    reply = await callAI(messages, {
      max_output_tokens: 900,
      temperature: 0.3,
    });
  } catch (e) {
    console.error("❌ AI error:", e);
    reply = "⚠️ ИИ временно недоступен.";
  }

  await pool.query("UPDATE tasks SET last_run = NOW() WHERE id = $1", [task.id]);

  await bot.sendMessage(
    chatId,
    `🚀 Задача #${task.id} выполнена ИИ-движком.\n\n${reply}`
  );
}
