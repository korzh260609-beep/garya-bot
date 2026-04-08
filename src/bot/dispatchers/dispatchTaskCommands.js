// src/bot/dispatchers/dispatchTaskCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import pool from "../../../db.js";

import { handleTasksList } from "../handlers/tasksList.js";
import { handleStopTasksType } from "../handlers/stopTasksType.js";
import { handleStopAllTasks } from "../handlers/stopAllTasks.js";
import { handleStartTask } from "../handlers/startTask.js";
import { handleStopTask } from "../handlers/stopTask.js";

// ✅ Stage 5–6: manual /run must write task_runs via JobRunner
import { jobRunner } from "../../jobs/jobRunnerInstance.js";
import { makeTaskRunKey } from "../../jobs/jobRunner.js";

// ✅ Stage 6 — helpers (used for /stop_task)
import { canStopTaskV1 } from "../../../core/helpers.js";

export async function dispatchTaskCommands({ cmd0, ctx, reply }) {
  const { bot, chatId, chatIdStr, rest } = ctx;

  switch (cmd0) {
    case "/tasks": {
      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      await handleTasksList({
        bot,
        chatId,
        chatIdStr,
        getUserTasks: ctx.getUserTasks,
        access,
      });

      return { handled: true };
    }

    case "/newtask":
    case "/new_task": {
      const raw = String(rest || "").trim();

      if (!raw) {
        await reply(
          [
            "Использование:",
            "- /newtask <title> | <note>  (manual, legacy)",
            '- /newtask price_monitor {"symbol":"BTCUSDT","interval_minutes":1,"threshold_percent":1}',
            "",
            "Примечание: price_monitor сейчас создаётся тестовым шаблоном (payload из JSON может игнорироваться).",
          ].join("\n"),
          { cmd: cmd0, handler: "commandDispatcher" }
        );
        return { handled: true };
      }

      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      if (raw.includes("|")) {
        const parts = raw.split("|").map((s) => s.trim());
        const title = parts[0] || "Новая задача";
        const note = parts.slice(1).join(" | ").trim() || "";

        if (typeof ctx.createManualTask !== "function") {
          await reply("⛔ createManualTask недоступен (ошибка wiring).", {
            cmd: cmd0,
            handler: "commandDispatcher",
          });
          return { handled: true };
        }

        try {
          const row = await ctx.createManualTask(chatIdStr, title, note, access);
          const id = row?.id ?? "?";
          await reply(`✅ Задача создана: #${id}\n${title}\nТип: manual`, {
            cmd: cmd0,
            handler: "commandDispatcher",
          });
        } catch (e) {
          await reply(`⛔ ${e?.message || "Запрещено"}`, {
            cmd: cmd0,
            handler: "commandDispatcher",
          });
        }

        return { handled: true };
      }

      const firstSpace = raw.indexOf(" ");
      const type = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).trim();
      const jsonPart = (firstSpace === -1 ? "" : raw.slice(firstSpace + 1)).trim();

      if (type === "price_monitor") {
        if (typeof ctx.createTestPriceMonitorTask !== "function") {
          await reply("⛔ createTestPriceMonitorTask недоступен (ошибка wiring).", {
            cmd: cmd0,
            handler: "commandDispatcher",
          });
          return { handled: true };
        }

        if (jsonPart) {
          try {
            JSON.parse(jsonPart);
          } catch (e) {
            await reply(
              '⛔ Неверный JSON. Пример: /newtask price_monitor {"symbol":"BTCUSDT","interval_minutes":1,"threshold_percent":1}',
              { cmd: cmd0, handler: "commandDispatcher" }
            );
            return { handled: true };
          }
        }

        try {
          const id = await ctx.createTestPriceMonitorTask(chatIdStr, access);
          await reply(
            [
              `✅ Тест price_monitor создан!`,
              `ID: ${id}`,
              jsonPart ? "ℹ️ JSON принят, но сейчас может игнорироваться (тестовый шаблон)." : "",
            ]
              .filter(Boolean)
              .join("\n"),
            { cmd: cmd0, handler: "commandDispatcher" }
          );
        } catch (e) {
          await reply(`⛔ ${e?.message || "Запрещено"}`, {
            cmd: cmd0,
            handler: "commandDispatcher",
          });
        }

        return { handled: true };
      }

      if (typeof ctx.createManualTask !== "function") {
        await reply("⛔ createManualTask недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      try {
        const row = await ctx.createManualTask(chatIdStr, raw, "", access);
        const id = row?.id ?? "?";
        await reply(`✅ Задача создана: #${id}\n${raw}\nТип: manual`, {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
      } catch (e) {
        await reply(`⛔ ${e?.message || "Запрещено"}`, {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
      }

      return { handled: true };
    }

    case "/run":
    case "/run_task": {
      const raw = String(rest || "").trim();
      const taskId = parseInt(raw, 10);

      if (!raw || Number.isNaN(taskId)) {
        await reply("Использование: /run <id>", { cmd: cmd0, handler: "commandDispatcher" });
        return { handled: true };
      }

      if (typeof ctx.getTaskById !== "function" || typeof ctx.runTaskWithAI !== "function") {
        await reply("⛔ TaskEngine недоступен (ошибка wiring).", {
          cmd: cmd0,
          handler: "commandDispatcher",
        });
        return { handled: true };
      }

      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      const task = await ctx.getTaskById(chatIdStr, taskId, access);

      if (!task) {
        await reply(`⛔ Задача #${taskId} не найдена`, { cmd: cmd0, handler: "commandDispatcher" });
        return { handled: true };
      }

      const runKey = makeTaskRunKey({
        taskId: task.id,
        scheduledForIso: new Date().toISOString(),
      });

      await jobRunner.enqueue(
        {
          taskId: task.id,
          runKey,
          meta: { source: "manual" },
        },
        { idempotencyKey: runKey }
      );

      await jobRunner.runOnce(async () => {
        await ctx.runTaskWithAI(task, chatId, bot, access);
      });

      return { handled: true };
    }

    case "/stop_task": {
      const access = {
        userRole: ctx.userRole || ctx.user?.role || "guest",
        userPlan: ctx.userPlan || ctx.user?.plan || "free",
        user: ctx.user,
      };

      await handleStopTask({
        bot,
        chatId,
        chatIdStr,
        rest,
        userRole: ctx.userRole,
        bypass: ctx.bypass,
        getTaskById: ctx.getTaskById,
        canStopTaskV1,
        updateTaskStatus: ctx.updateTaskStatus,
        access,
      });

      return { handled: true };
    }

    case "/start_task": {
      await handleStartTask({
        bot,
        chatId,
        rest,
        bypass: ctx.bypass,
        updateTaskStatus: ctx.updateTaskStatus,
      });
      return { handled: true };
    }

    case "/stop_tasks_type": {
      await handleStopTasksType({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
        pool,
      });
      return { handled: true };
    }

    case "/stop_all_tasks":
    case "/stop_all": {
      await handleStopAllTasks({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}