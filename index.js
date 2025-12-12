// ============================================================================
// === INDEX — ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ, СЕРВЕР, ВЕБХУК, КОМАНДЫ, AI ===
// ============================================================================

// === БАЗОВЫЕ ИМПОРТЫ ===
import express from "express";
import TelegramBot from "node-telegram-bot-api";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "./core/answerMode.js";
import { loadProjectContext } from "./core/projectContext.js";
// === SYSTEM PROMPT ===
import { buildSystemPrompt } from "./systemPrompt.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "./src/memory/chatMemory.js";

// === USERS ===
import { ensureUserProfile } from "./src/users/userProfile.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
} from "./src/tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  ensureDefaultSources,
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
} from "./src/sources/sources.js";

// === COINGECKO (V1 SIMPLE PRICE) ===
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "./src/sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import { summarizeMediaAttachment } from "./src/media/fileIntake.js";

// === LOGGING ===
import { logInteraction } from "./src/logging/interactionLogs.js";

// === ROBOT MOCK-LAYER ===
import { startRobotLoop } from "./src/robot/robotMock.js";

// === AI ===
import { callAI } from "./ai.js";

// === DB ===
import pool from "./db.js";

// === CONSTANTS ===
const MAX_HISTORY_MESSAGES = 20;

// ============================================================================
// === MINI-ACCESS V0 (начало Этапа 7, без новых таблиц) ===
// ============================================================================
const MONARCH_CHAT_ID = "677128443";

function isMonarch(chatIdStr) {
  return chatIdStr === MONARCH_CHAT_ID;
}

async function guardMonarch(
  bot,
  chatId,
  chatIdStr,
  actionText = "Эта команда"
) {
  if (!isMonarch(chatIdStr)) {
    await bot.sendMessage(chatId, `${actionText} доступна только монарху GARYA.`);
    return false;
  }
  return true;
}

// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ============================================================================
// === TELEGRAM BOT И ВЕБХУК ===
// ============================================================================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN отсутствует!");
  process.exit(1);
}

const bot = new TelegramBot(token);
const WEBHOOK_URL = `https://garya-bot.onrender.com/webhook/${token}`;
bot.setWebHook(WEBHOOK_URL);

app.get("/", (req, res) => res.send("GARYA AI Bot работает ⚡"));

app.post(`/webhook/${token}`, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ bot.processUpdate error:", err);
  }
});

// ============================================================================
// === ЗАПУСК СЕРВЕРА И ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ===
// ============================================================================
app.listen(PORT, async () => {
  console.log("🌐 HTTP-сервер запущен на порту:", PORT);

  try {
    // 1) Sources registry
    await ensureDefaultSources();
    console.log("📡 Sources registry готов.");

    // 2) Robot Layer
    startRobotLoop(bot);
    console.log("🤖 ROBOT mock-layer запущен.");
  } catch (e) {
    console.error("❌ ERROR при инициализации:", e);
  }
});

// ============================================================================
// === ОБРАБОТКА ВСЕХ СООБЩЕНИЙ: КОМАНДЫ + ЧАТ + AI ===
// ============================================================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // 1) Профиль пользователя
  await ensureUserProfile(msg);

  // 1.1) Роль и план (для Source-Permissions 5.12)
  let userRole = "guest";
  let userPlan = "free"; // планы пока не реализованы, по умолчанию free

  try {
    const uRes = await pool.query(
      "SELECT role FROM users WHERE chat_id = $1",
      [chatIdStr]
    );
    if (uRes.rows.length) {
      userRole = uRes.rows[0].role || "guest";
    }
  } catch (e) {
    console.error("❌ Error fetching user role:", e);
  }

  const text = msg.text || "";
  const trimmed = text.trim();

  // --- FILE-INTAKE ---
  const media = summarizeMediaAttachment(msg);

  // ========================================================================
  // === ОБРАБОТКА КОМАНД ===
  // ========================================================================
  if (trimmed.startsWith("/")) {
    const args = trimmed.split(" ").slice(1).join(" ");
    const cmd = trimmed.split(" ")[0];

    switch (cmd) {
      // --------------------------- Профиль -------------------------------
      case "/profile":
      case "/me":
      case "/whoami": {
        const res = await pool.query(
          "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
          [chatIdStr]
        );
        if (res.rows.length === 0) {
          await bot.sendMessage(chatId, "Профиль не найден.");
          return;
        }

        const u = res.rows[0];
        await bot.sendMessage(
          chatId,
          `🧾 Профиль\nID: ${u.chat_id}\nИмя: ${u.name}\nРоль: ${u.role}\nСоздан: ${u.created_at}`
        );
        return;
      }

      // -------------------- Статистика пользователей ---------------------
      case "/users_stats": {
        if (
          !(await guardMonarch(
            bot,
            chatId,
            chatIdStr,
            "Команда /users_stats"
          ))
        )
          return;

        try {
          const totalRes = await pool.query(
            "SELECT COUNT(*)::int AS total FROM users"
          );
          const total = totalRes.rows[0]?.total ?? 0;

          const byRoleRes = await pool.query(`
            SELECT COALESCE(role, 'unknown') AS role,
                   COUNT(*)::int AS count
            FROM users
            GROUP BY COALESCE(role, 'unknown')
            ORDER BY role
          `);

          let out = "👥 Статистика пользователей СГ\n\n";
          out += `Всего пользователей: ${total}\n\n`;

          if (byRoleRes.rows.length) {
            out += "По ролям:\n";
            for (const r of byRoleRes.rows) {
              out += `• ${r.role}: ${r.count}\n`;
            }
          }

          await bot.sendMessage(chatId, out);
        } catch (e) {
          console.error("❌ Error in /users_stats:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось получить статистику пользователей."
          );
        }
        return;
      }

      // --------------------------- demo_task -----------------------------
      case "/demo_task": {
        const id = await createDemoTask(chatIdStr);
        await bot.sendMessage(chatId, `✅ Демо-задача создана!\nID: ${id}`);
        return;
      }

      // --------------------------- btc test ------------------------------
      case "/btc_test_task": {
        const task = await createTestPriceMonitorTask(chatIdStr);
        await bot.sendMessage(
          chatId,
          `🆕 Тест price_monitor создан!\nID: ${task.id}\nРасписание: ${task.schedule}`
        );
        return;
      }

      // --------------------------- newtask -------------------------------
      case "/newtask": {
        if (!args.trim()) {
          await bot.sendMessage(chatId, "Использование: /newtask <описание>");
          return;
        }

        const task = await createManualTask(chatIdStr, args.trim());
        await bot.sendMessage(chatId, `🆕 Задача создана!\n#${task.id}`);
        return;
      }

      // --------------------------- run task ------------------------------
      case "/run": {
        const id = Number(args.trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /run <id>");
          return;
        }

        const task = await getTaskById(chatIdStr, id);
        if (!task) {
          await bot.sendMessage(chatId, "Задача не найдена.");
          return;
        }

        await bot.sendMessage(chatId, `Запуск задачи #${task.id}...`);
        await runTaskWithAI(task, chatId);
        return;
      }

      // --------------------------- tasks list ----------------------------
      case "/tasks": {
        const tasks = await getUserTasks(chatIdStr, 30);

        if (!tasks.length) {
          await bot.sendMessage(chatId, "У вас нет задач.");
          return;
        }

        let out = "📋 Ваши задачи:\n\n";
        for (const t of tasks) {
          out += `#${t.id} — ${t.title}\nТип: ${t.type}\nСтатус: ${t.status}\n\n`;
        }

        await bot.sendMessage(chatId, out);
        return;
      }

      // ---------------------- stop_all_tasks -----------------------------
      case "/stop_all_tasks": {
        try {
          const res = await pool.query(`
            UPDATE tasks
            SET status = 'stopped'
            WHERE status = 'active';
          `);

          await bot.sendMessage(
            chatId,
            `⛔ Остановлены все активные задачи.\nИзменено записей: ${res.rowCount}.`
          );
        } catch (err) {
          console.error("❌ Error in /stop_all_tasks:", err);
          await bot.sendMessage(
            chatId,
            "⚠️ Ошибка при попытке остановить задачи."
          );
        }
        return;
      }

      // --------------------------- stop_task -----------------------------
      case "/stop_task": {
        const id = Number(args.trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /stop_task <id>");
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'stopped' WHERE id = $1;`,
            [id]
          );

          if (res.rowCount === 0) {
            await bot.sendMessage(
              chatId,
              `⚠️ Задача с ID ${id} не найдена.`
            );
          } else {
            await bot.sendMessage(chatId, `⛔ Задача ${id} остановлена.`);
          }
        } catch (err) {
          console.error("❌ Error in /stop_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задачи.");
        }
        return;
      }

      // --------------------------- start_task ----------------------------
      case "/start_task": {
        const id = Number(args.trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /start_task <id>");
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'active' WHERE id = $1;`,
            [id]
          );

          if (res.rowCount === 0) {
            await bot.sendMessage(
              chatId,
              `⚠️ Задача с ID ${id} не найдена.`
            );
          } else {
            await bot.sendMessage(chatId, `✅ Задача ${id} снова активна.`);
          }
        } catch (err) {
          console.error("❌ Error in /start_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при запуске задачи.");
        }
        return;
      }

      // --------------------------- stop_tasks_type ------------------------
      case "/stop_tasks_type": {
        const taskType = args.trim();
        if (!taskType) {
          await bot.sendMessage(
            chatId,
            "Использование: /stop_tasks_type <type>\nНапример: /stop_tasks_type price_monitor"
          );
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'stopped' WHERE type = $1 AND status = 'active';`,
            [taskType]
          );

          await bot.sendMessage(
            chatId,
            `⛔ Остановлены все активные задачи типа "${taskType}".\nИзменено записей: ${res.rowCount}.`
          );
        } catch (err) {
          console.error("❌ Error при остановке задач по типу:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задач по типу.");
        }
        return;
      }

      // --------------------------- SOURCES -------------------------------
      case "/sources": {
        const sources = await getAllSourcesSafe();
        const out = formatSourcesList(sources);
        await bot.sendMessage(chatId, out, { parse_mode: "HTML" });
        return;
      }

      case "/sources_diag": {
        const summary = await runSourceDiagnosticsOnce({
          userRole,
          userPlan,
          bypassPermissions: isMonarch(chatIdStr),
        });

        const textDiag =
          `🩺 Диагностика источников\n` +
          `Всего: ${summary.total}\n` +
          `OK: ${summary.okCount}\n` +
          `Ошибок: ${summary.failCount}`;

        await bot.sendMessage(chatId, textDiag);
        return;
      }

      case "/source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(chatId, "Использование: /source <key>");
          return;
        }

        const result = await fetchFromSourceKey(key, {
          userRole,
          userPlan,
        });

        if (!result.ok) {
          await bot.sendMessage(
            chatId,
            `❌ Ошибка при обращении к источнику <code>${key}</code>:\n<code>${result.error || "Unknown error"}</code>`,
            { parse_mode: "HTML" }
          );
          return;
        }

        await bot.sendMessage(
          chatId,
          JSON.stringify(result, null, 2).slice(0, 900)
        );
        return;
      }

      // ---------------------- NEW COMMAND: /diag_source -------------------
      case "/diag_source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Использование: /diag_source <key>\nПример: /diag_source coingecko_simple_price",
            { parse_mode: "HTML" }
          );
          return;
        }

        try {
          const res = await diagnoseSource(key, {
            userRole,
            userPlan,
            bypassPermissions: isMonarch(chatIdStr),
          });

          if (!res.ok) {
            await bot.sendMessage(
              chatId,
              [
                `Диагностика <code>${key}</code>: ❌`,
                res.error
                  ? `Ошибка: <code>${res.error}</code>`
                  : "Неизвестная ошибка",
              ].join("\n"),
              { parse_mode: "HTML" }
            );
            return;
          }

          await bot.sendMessage(
            chatId,
            [
              `Диагностика <code>${key}</code>: ✅ OK`,
              res.httpStatus
                ? `HTTP статус: <code>${res.httpStatus}</code>`
                : "HTTP статус: n/a",
              res.type ? `type: <code>${res.type}</code>` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            { parse_mode: "HTML" }
          );
        } catch (err) {
          console.error("❌ /diag_source error:", err);
          await bot.sendMessage(
            chatId,
            `Ошибка при диагностике: <code>${err.message || err}</code>`,
            { parse_mode: "HTML" }
          );
        }
        return;
      }

      // --------------------------- /price (CoinGecko) --------------------
      case "/price": {
        const coinId = args.trim().toLowerCase();
        if (!coinId) {
          await bot.sendMessage(
            chatId,
            "Использование: /price <coinId>\nПример: /price bitcoin"
          );
          return;
        }

        const result = await getCoinGeckoSimplePriceById(coinId, "usd", {
          userRole,
          userPlan,
        });

        if (!result.ok) {
          const errText = String(result.error || "");
          if (result.httpStatus === 429 || errText.includes("429")) {
            await bot.sendMessage(
              chatId,
              "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты."
            );
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        await bot.sendMessage(
          chatId,
          `💰 ${result.id.toUpperCase()}: $${result.price}`
        );
        return;
      }

      // --------------------------- /prices (multi) -----------------------
      case "/prices": {
        let idsArg = args.trim().toLowerCase();
        let ids;

        // по умолчанию — BTC/ETH/SOL
        if (!idsArg) {
          ids = ["bitcoin", "ethereum", "solana"];
        } else {
          ids = idsArg
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const result = await getCoinGeckoSimplePriceMulti(ids, "usd", {
          userRole,
          userPlan,
        });

        if (!result.ok) {
          const errText = String(result.error || "");
          if (result.httpStatus === 429 || errText.includes("429")) {
            await bot.sendMessage(
              chatId,
              "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты."
            );
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        // выводим в порядке запрошенных id
        let out = "💰 Цены (CoinGecko, USD):\n\n";
        for (const id of ids) {
          const item = result.items[id];
          if (!item) {
            out += `• ${id.toUpperCase()}: нет данных\n`;
          } else {
            out += `• ${item.id.toUpperCase()}: $${item.price}\n`;
          }
        }

        await bot.sendMessage(chatId, out);
        return;
      }

      // --------------------------- PROJECT MEMORY ------------------------
      case "/pm_show": {
        const section = args.trim();
        if (!section) {
          await bot.sendMessage(chatId, "Использование: /pm_show <section>");
          return;
        }

        const rec = await pool.query(
          "SELECT section, content, updated_at FROM project_memory WHERE section = $1 LIMIT 1",
          [section]
        );

        if (!rec.rows.length) {
          await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
          return;
        }

        const r = rec.rows[0];
        await bot.sendMessage(
          chatId,
          `🧠 Project Memory: ${r.section}\n\n${r.content.slice(0, 3500)}`
        );
        return;
      }

      case "/pm_set": {
        if (
          !(await guardMonarch(bot, chatId, chatIdStr, "Команда /pm_set"))
        )
          return;

        const firstSpace = args.indexOf(" ");
        if (firstSpace === -1) {
          await bot.sendMessage(
            chatId,
            "Использование: /pm_set <section> <text>"
          );
          return;
        }

        const section = args.slice(0, firstSpace).trim();
        const content = args.slice(firstSpace + 1).trim();

        await pool.query(
          `
            INSERT INTO project_memory (section, content)
            VALUES ($1, $2)
            ON CONFLICT (section)
            DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
          `,
          [section, content]
        );

        await bot.sendMessage(chatId, `Обновлено: ${section}`);
        return;
      }

      // --------------------------- РЕЖИМЫ ОТВЕТОВ ------------------------
      case "/mode": {
        const mode = args.trim().toLowerCase();
        const valid = ["short", "normal", "long"];

        if (!valid.includes(mode)) {
          await bot.sendMessage(chatId, "Режимы: short / normal / long");
          return;
        }

        setAnswerMode(chatIdStr, mode);
        await bot.sendMessage(chatId, `Режим ответа: ${mode}`);
        return;
      }

      // -------------------------------------------------------------------
      default:
        break;
    }
  }

  // ========================================================================
  // === НЕ КОМАНДЫ: ПАМЯТЬ + PROJECT CONTEXT + AI ===
  // ========================================================================

  const mediaText = media ? `Вложение: ${media}` : "";
  let effective = trimmed || mediaText;
  if (trimmed && mediaText) {
    effective = `${trimmed}\n\n(${mediaText})`;
  }

  // 1) сохраняем сообщение
  await saveMessageToMemory(chatIdStr, "user", effective);

  // 2) читаем историю
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // 3) классификация
  const classification = {
    taskType: "chat",
    aiCostLevel: "low",
  };

  await logInteraction(chatIdStr, classification);

  // 4) Project Context
  const projectCtx = await loadProjectContext();

  // 5) System Prompt (V2 через systemPrompt.js)
  const answerMode = getAnswerMode(chatIdStr);

  // Краткое текстовое описание режима (подставляется в systemPrompt)
  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction =
      "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const systemPrompt = buildSystemPrompt(
    answerMode,
    modeInstruction,
    projectCtx || ""
  );

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effective },
  ];

  // 6) настройка вывода
  let maxTokens = 350;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // 7) вызов ИИ
  let aiReply = "";
  try {
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("❌ AI error:", e);
    aiReply = "⚠️ Ошибка вызова ИИ.";
  }

  // 8) сохраняем pair
  await saveChatPair(chatIdStr, effective, aiReply);

  // 9) отправляем ответ
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
});

// ============================================================================
console.log("🤖 GARYA AI Bot (modular index.js) работает…");
