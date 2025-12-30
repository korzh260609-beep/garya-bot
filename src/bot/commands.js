// bot/commands.js
// Обработка всех текстовых команд (/profile, /tasks, /task, /mode, /pm_set и т.д.)

import pool from "../db.js";
import * as Sources from "../sources.js";

import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  updateTaskStatus,
  runTaskWithAI,
} from "../tasks/taskEngine.js";

import {
  getAllSourcesSafe,
  formatSourcesList,
} from "../sources/sourcesDebug.js";

import { getProjectSection, upsertProjectSection } from "../projectMemory.js";
import { setAnswerMode } from "../core/answerMode.js";

// Главный обработчик текстовых команд.
// Это та же логика, что была в index.js внутри switch(command).
export async function handleCommand(bot, msg, command, commandArgs) {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  switch (command) {
    case "/profile":
    case "/whoami":
    case "/me": {
      try {
        const res = await pool.query(
          "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
          [chatIdStr]
        );

        if (res.rows.length === 0) {
          await bot.sendMessage(
            chatId,
            "Пока что у меня нет данных о вашем профиле в системе."
          );
        } else {
          const u = res.rows[0];
          const text =
            `🧾 Профиль пользователя\n` +
            `ID чата: \`${u.chat_id}\`\n` +
            `Имя: ${u.name || "—"}\n` +
            `Роль: ${u.role || "—"}\n` +
            `Язык: ${u.language || "—"}\n` +
            `Создан: ${u.created_at?.toISOString?.() || "—"}`;

          await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        }
      } catch (e) {
        console.error("❌ Error in /profile:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось прочитать профиль пользователя."
        );
      }
      return;
    }

    case "/demo_task": {
      try {
        const id = await createDemoTask(chatIdStr);
        await bot.sendMessage(
          chatId,
          `✅ Демо-задача создана! ID: ${id}\n` +
            "Пока что это просто запись в таблице tasks. В будущем сюда прикрутим реальные отчёты/мониторинг."
        );
      } catch (e) {
        console.error("❌ Error in /demo_task:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось создать демо-задачу. См. логи сервера."
        );
      }
      return;
    }

    case "/run": {
      const idStr = commandArgs.trim();
      if (!idStr) {
        await bot.sendMessage(
          chatId,
          "Нужно указать ID задачи. Пример: `/run 1`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const taskId = Number(idStr);
      if (Number.isNaN(taskId)) {
        await bot.sendMessage(chatId, "ID задачи должен быть числом.");
        return;
      }

      try {
        const task = await getTaskById(chatIdStr, taskId);
        if (!task) {
          await bot.sendMessage(
            chatId,
            `Я не нашёл задачу #${taskId} среди ваших задач.`
          );
          return;
        }

        await bot.sendMessage(
          chatId,
          `🚀 Запускаю задачу #${task.id} через ИИ-движок...`
        );
        await runTaskWithAI(task, chatId, bot);
      } catch (e) {
        console.error("❌ Error in /run:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось запустить задачу. См. логи сервера."
        );
      }
      return;
    }

    case "/btc_test_task": {
      try {
        const taskId = await createTestPriceMonitorTask(chatIdStr);
        await bot.sendMessage(
          chatId,
          `🆕 Тестовая задача мониторинга BTC создана!\n\n` +
            `#${taskId} — price_monitor\n` +
            `Статус: active\n` +
            `Описание: BTC monitor test (раз в час)\n` +
            `Расписание (cron): 0 * * * *\n`
        );
      } catch (e) {
        console.error("❌ Error in /btc_test_task:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось создать тестовую задачу мониторинга BTC."
        );
      }
      return;
    }

    case "/newtask": {
      const taskText = commandArgs;
      if (!taskText) {
        await bot.sendMessage(
          chatId,
          "Нужно указать описание задачи.\n\nПример:\n`/newtask кратко опиши, что делать`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const task = await createManualTask(chatIdStr, "Manual task", taskText);

        await bot.sendMessage(
          chatId,
          `🆕 Задача создана!\n\n` +
            `#${task.id} — manual\n` +
            `Статус: active\n` +
            `Описание: ${taskText}\n` +
            `Создана: ${task.created_at?.toISOString?.() || "—"}`
        );
      } catch (e) {
        console.error("❌ Error in /newtask:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось создать задачу в Task Engine."
        );
      }
      return;
    }

    case "/tasks": {
      try {
        const tasks = await getUserTasks(chatIdStr, 30);
        if (!tasks || tasks.length === 0) {
          await bot.sendMessage(
            chatId,
            "У вас пока нет задач в Task Engine.\n" +
              "Создайте демо-задачу командой /demo_task или задачу вручную через /newtask."
          );
        } else {
          let text = "📋 Ваши задачи:\n\n";
          for (const t of tasks) {
            text +=
              `#${t.id} — ${t.title}\n` +
              `Тип: ${t.type}\n` +
              `Статус: ${t.status}\n` +
              `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
              (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
              (t.last_run
                ? `Последний запуск: ${t.last_run.toISOString()}\n`
                : "") +
              `\n`;
          }
          await bot.sendMessage(chatId, text);
        }
      } catch (e) {
        console.error("❌ Error in /tasks:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось получить список задач из Task Engine."
        );
      }
      return;
    }

    // Универсальная команда /task
    case "/task": {
      const raw = commandArgs.trim();

      // без аргументов — помощь
      if (!raw) {
        await bot.sendMessage(
          chatId,
          "Команда `/task` — работа с задачами Task Engine.\n\n" +
            "Варианты использования:\n" +
            "• `/task list` — показать список ваших задач\n" +
            "• `/task new <описание>` — создать новую задачу\n" +
            "• `/task pause <id>` — поставить задачу на паузу\n" +
            "• `/task resume <id>` — возобновить задачу\n" +
            "• `/task delete <id>` — пометить задачу как удалённую\n" +
            "• `/task <id>` — показать подробности по задаче\n",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const [first, ...restParts] = raw.split(" ");
      const firstLower = first.toLowerCase();
      const restText = restParts.join(" ").trim();

      // /task list
      if (firstLower === "list") {
        try {
          const tasks = await getUserTasks(chatIdStr, 50);
          if (!tasks || tasks.length === 0) {
            await bot.sendMessage(
              chatId,
              "У вас пока нет задач в Task Engine."
            );
          } else {
            let text = "📋 Ваши задачи:\n\n";
            for (const t of tasks) {
              text +=
                `#${t.id} — ${t.title}\n` +
                `Тип: ${t.type}\n` +
                `Статус: ${t.status}\n` +
                `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
                (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
                (t.last_run
                  ? `Последний запуск: ${t.last_run.toISOString()}\n`
                  : "") +
                `\n`;
            }
            await bot.sendMessage(chatId, text);
          }
        } catch (e) {
          console.error("❌ Error in /task list:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось получить список задач из Task Engine."
          );
        }
        return;
      }

      // /task new <описание>
      if (firstLower === "new") {
        if (!restText) {
          await bot.sendMessage(
            chatId,
            "Использование:\n`/task new <описание задачи>`\n\n" +
              "Пример:\n`/task new следи за ценой BTC раз в час`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const task = await createManualTask(chatIdStr, restText);

          await bot.sendMessage(
            chatId,
            `🆕 Задача создана!\n\n` +
              `#${task.id} — manual\n` +
              `Статус: active\n` +
              `Описание: ${restText}\n` +
              `Создана: ${task.created_at?.toISOString?.() || "—"}`
          );
        } catch (e) {
          console.error("❌ Error in /task new:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось создать задачу в Task Engine."
          );
        }
        return;
      }

      // /task pause|resume|delete <id>
      if (
        firstLower === "pause" ||
        firstLower === "resume" ||
        firstLower === "delete"
      ) {
        if (!restText) {
          await bot.sendMessage(
            chatId,
            "Нужно указать ID задачи.\n\nПримеры:\n" +
              "`/task pause 10`\n" +
              "`/task resume 10`\n" +
              "`/task delete 10`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        const taskId = Number(restText);
        if (Number.isNaN(taskId)) {
          await bot.sendMessage(
            chatId,
            "ID задачи должен быть числом.\nПример: `/task pause 10`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const existing = await getTaskById(chatIdStr, taskId);
          if (!existing) {
            await bot.sendMessage(
              chatId,
              `Я не нашёл задачу #${taskId} среди ваших задач.`
            );
            return;
          }

          let newStatus = existing.status;
          let msgText = "";

          if (firstLower === "pause") {
            newStatus = "paused";
            msgText = `⏸ Задача #${taskId} поставлена на паузу.`;
          } else if (firstLower === "resume") {
            newStatus = "active";
            msgText = `▶️ Задача #${taskId} возобновлена.`;
          } else if (firstLower === "delete") {
            newStatus = "deleted";
            msgText = `🗑 Задача #${taskId} помечена как удалённая.`;
          }

          await updateTaskStatus(taskId, newStatus);
          await bot.sendMessage(chatId, msgText);
        } catch (e) {
          console.error("❌ Error in /task pause/resume/delete:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось обновить статус задачи. См. логи сервера."
          );
        }
        return;
      }

      // /task <id> — показать детали
      const taskId = Number(first);
      if (Number.isNaN(taskId)) {
        await bot.sendMessage(
          chatId,
          "Неизвестная подкоманда для /task. Используйте `list`, `new`, `pause`, `resume`, `delete` или ID задачи.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const task = await getTaskById(chatIdStr, taskId);
        if (!task) {
          await bot.sendMessage(
            chatId,
            `Я не нашёл задачу #${taskId} среди ваших задач.`
          );
          return;
        }

        const text =
          `🔍 Задача #${task.id}\n\n` +
          `Название: ${task.title}\n` +
          `Тип: ${task.type}\n` +
          `Статус: ${task.status}\n` +
          `Создана: ${task.created_at?.toISOString?.() || "—"}\n` +
          (task.schedule ? `Расписание: ${task.schedule}\n` : "") +
          (task.last_run
            ? `Последний запуск: ${task.last_run.toISOString()}\n`
            : "") +
          `\n` +
          `Задачу можно запустить командой: \`/run ${task.id}\``;

        await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      } catch (e) {
        console.error("❌ Error in /task <id>:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось прочитать задачу. См. логи сервера."
        );
      }
      return;
    }

    case "/meminfo": {
      try {
        const res = await pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM chat_memory
            WHERE chat_id = $1
          `,
          [chatIdStr]
        );

        const total = res.rows[0]?.total ?? 0;

        await bot.sendMessage(
          chatId,
          `📊 Память по этому чату: ${total} сообщений.`
        );
      } catch (e) {
        console.error("❌ /meminfo error:", e);
        await bot.sendMessage(chatId, "Ошибка чтения памяти.");
      }
      return;
    }

    case "/memstats": {
      try {
        const res = await pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM chat_memory
            WHERE chat_id = $1
          `,
          [chatIdStr]
        );

        const total = res.rows[0]?.total ?? 0;

        let latestBlock = "Нет записей в памяти.";
        if (total > 0) {
          const last = await pool.query(
            `
              SELECT role, content, created_at
              FROM chat_memory
              WHERE chat_id = $1
              ORDER BY id DESC
              LIMIT 1
            `,
            [chatIdStr]
          );

          const row = last.rows[0];
          if (row) {
            const snippet =
              row.content.length > 400
                ? row.content.slice(0, 400) + "..."
                : row.content;
            latestBlock =
              `Последняя запись:\n` +
              `🕒 ${row.created_at}\n` +
              `🎭 Роль: ${row.role}\n` +
              `💬 Текст: ${snippet}`;
          }
        }

        const text =
          `📊 Статус долговременной памяти\n` +
          `Всего сообщений в памяти: ${total}\n\n` +
          `${latestBlock}`;

        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ /memstats error:", e);
        await bot.sendMessage(chatId, "Ошибка чтения памяти.");
      }
      return;
    }

    case "/sources": {
      try {
        const sources = await getAllSourcesSafe();
        const text = formatSourcesList(sources);
        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /sources:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось получить список источников."
        );
      }
      return;
    }

    // Новая команда: диагностика всех источников
    case "/sources_diag": {
      try {
        const summary = await Sources.runSourceDiagnosticsOnce();

        const lines = [];
        lines.push("🩺 Диагностика всех активных источников:");
        lines.push(`Всего: ${summary.total}`);
        lines.push(`OK: ${summary.okCount}`);
        lines.push(`С ошибками: ${summary.failCount}`);

        if (summary.failCount > 0) {
          lines.push("");
          lines.push("Проблемные источники:");
          for (const item of summary.items) {
            if (item.ok) continue;
            lines.push(
              `- ${item.key}: ${item.error || "неизвестная ошибка"}`
            );
          }
        }

        await bot.sendMessage(chatId, lines.join("\n"));
      } catch (e) {
        console.error("❌ Error in /sources_diag:", e);
        await bot.sendMessage(
          chatId,
          "❌ Ошибка при диагностике источников. См. логи сервера."
        );
      }
      return;
    }

    // /source <key> — быстрый просмотр одного источника через Sources.fetchFromSourceKey
    case "/source": {
      const key = commandArgs.trim();
      if (!key) {
        await bot.sendMessage(
          chatId,
          "Нужно указать ключ источника.\nПример: `/source coingecko_simple_price`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const result = await Sources.fetchFromSourceKey(key);
        const ok = !!result && result.ok !== false;

        if (!ok) {
          const msgLines = [];
          msgLines.push(`❌ Источник "${key}" вернул ошибку.`);
          if (result && result.error) {
            msgLines.push("");
            msgLines.push(`Ошибка: ${result.error}`);
          }
          await bot.sendMessage(chatId, msgLines.join("\n"));
          return;
        }

        const payload =
          result.data ||
          result.htmlSnippet ||
          result.xmlSnippet ||
          result.items ||
          null;

        const previewObj = {
          ok: result.ok,
          sourceKey: result.sourceKey || key,
          type: result.type || "unknown",
          payload,
        };

        const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

        const text =
          `✅ Источник "${previewObj.sourceKey}" отработал успешно.\n\n` +
          `Тип: ${previewObj.type}\n\n` +
          `📄 Предпросмотр данных (обрезано):\n` +
          preview;

        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /source:", e);
        await bot.sendMessage(
          chatId,
          `❌ Внутренняя ошибка при работе с источником "${key}": ${e.message}`
        );
      }
      return;
    }

    // /diag_source <key> — детальная диагностика одного источника
    case "/diag_source": {
      const key = commandArgs.trim();
      if (!key) {
        await bot.sendMessage(
          chatId,
          "Нужно указать ключ источника.\nПример: `/diag_source coingecko_simple_price`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const result = await Sources.fetchFromSourceKey(key, { diag: true });
        const ok = !!result && result.ok !== false;

        const type = result.type || "unknown";
        const httpStatus =
          typeof result.httpStatus === "number"
            ? result.httpStatus
            : result.meta?.httpStatus ?? "—";

        const payload =
          result.data ||
          result.htmlSnippet ||
          result.xmlSnippet ||
          result.items ||
          null;

        const previewObj = {
          ok: result.ok,
          sourceKey: result.sourceKey || key,
          type,
          httpStatus,
          payload,
        };

        const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

        const text =
          `✅ Ответ от источника "${previewObj.sourceKey}".\n\n` +
          `Тип: ${type}\n` +
          `HTTP статус: ${httpStatus}\n\n` +
          `📄 Предпросмотр данных (обрезано):\n` +
          preview;

        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /diag_source:", e);
        await bot.sendMessage(
          chatId,
          `❌ Внутренняя ошибка при диагностике источника "${key}": ${e.message}`
        );
      }

      return;
    }

    case "/test_source": {
      // Обработчик уже реализован через bot.onText в другом месте,
      // здесь просто выходим, чтобы не срабатывать "неизвестная команда".
      return;
    }

    // === ПРОЕКТНАЯ ПАМЯТЬ: /pm_set и /pm_show ===
    case "/pm_set": {
      const userIsMonarch = chatIdStr === "677128443";

      if (!userIsMonarch) {
        await bot.sendMessage(
          chatId,
          "У вас нет прав изменять проектную память. Только монарх может это делать."
        );
        return;
      }

      const raw = commandArgs.trim();
      if (!raw) {
        await bot.sendMessage(
          chatId,
          "Использование:\n`/pm_set <section> <text>`\n\n" +
            "Пример:\n`/pm_set roadmap SG — ROADMAP V3.2 ...`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const firstSpace = raw.indexOf(" ");
      const section =
        firstSpace === -1 ? raw : raw.slice(0, firstSpace).trim();
      const content =
        firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();

      if (!section) {
        await bot.sendMessage(
          chatId,
          "Нужно указать секцию. Пример:\n`/pm_set roadmap ...текст...`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (!content) {
        await bot.sendMessage(
          chatId,
          "Нужно указать текст для записи в проектную память.\n" +
            "Пример:\n`/pm_set roadmap ROADMAP V1.5 ...`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const title = `Section: ${section}`;
        const meta = {
          section,
        };

        await upsertProjectSection(undefined, section, title, content, meta);

        await bot.sendMessage(
          chatId,
          `✅ Проектная память обновлена для секции "${section}".\n\n` +
            `Длина текста: ${content.length} символов.`
        );
      } catch (e) {
        console.error("❌ /pm_set error:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось обновить проектную память. См. логи сервера."
        );
      }

      return;
    }

    case "/pm_show": {
      const raw = commandArgs.trim();
      if (!raw) {
        await bot.sendMessage(
          chatId,
          "Нужно указать секцию. Пример:\n`/pm_show roadmap`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const section = raw.split(" ")[0];

      try {
        const record = await getProjectSection(undefined, section);

        if (!record) {
          await bot.sendMessage(
            chatId,
            `В проектной памяти пока нет секции "${section}".`
          );
          return;
        }

        const maxLen = 3500;
        const textSnippet =
          record.content.length > maxLen
            ? record.content.slice(0, maxLen) +
              "\n\n...(обрезано, текст слишком длинный)..."
            : record.content;

        const msg =
          `🧠 Project Memory: ${record.section}\n` +
          `ID: ${record.id}\n` +
          `Обновлено: ${record.updated_at}\n\n` +
          textSnippet;

        await bot.sendMessage(chatId, msg);
      } catch (e) {
        console.error("❌ /pm_show error:", e);
        await bot.sendMessage(
          chatId,
          "Не удалось прочитать проектную память. См. логи сервера."
        );
      }

      return;
    }

    case "/mode": {
      const arg = commandArgs.toLowerCase();
      const valid = ["short", "normal", "long"];

      if (!valid.includes(arg)) {
        await bot.sendMessage(
          chatId,
          "Режимы ответа:\n" +
            "- short  — очень кратко (до 1–2 предложений)\n" +
            "- normal — средне, 3–7 предложений\n" +
            "- long   — развернуто, с пунктами и объяснениями\n\n" +
            "Текущий режим меняется командой `/mode <short|normal|long>`.\n\n" +
            "Команды:\n" +
            "/profile — профиль пользователя\n" +
            "/demo_task — создать демо-задачу\n" +
            "/btc_test_task — тестовый мониторинг BTC (mock)\n" +
            "/newtask <описание> — создать задачу\n" +
            "/run <id>\n" +
            "/tasks\n" +
            "/task <list|new|pause|resume|delete|id>\n" +
            "/meminfo\n" +
            "/memstats\n" +
            "/sources\n" +
            "/sources_diag\n" +
            "/source <key>\n" +
            "/diag_source <key>\n" +
            "/test_source <key>\n" +
            "/pm_set <section> <text>\n" +
            "/pm_show <section>\n" +
            "/mode <short|normal|long>"
        );
        return;
      }

      setAnswerMode(chatIdStr, arg);

      let desc = "";
      if (arg === "short") {
        desc =
          "короткие ответы (1–2 предложения, без лишних деталей, с приоритетом экономии токенов).";
      } else if (arg === "normal") {
        desc =
          "средние ответы (3–7 предложений, немного деталей, умеренная экономия токенов).";
      } else if (arg === "long") {
        desc =
          "развернутые ответы с пунктами и объяснениями (больше токенов, максимум пользы).";
      }

      await bot.sendMessage(
        chatId,
        `✅ Режим ответа установлен: ${arg}.\n\nОписание: ${desc}`
      );
      return;
    }

    default:
      // Неизвестная команда — пусть дальше обрабатывается как обычный текст (ИИ)
      return;
  }
}

