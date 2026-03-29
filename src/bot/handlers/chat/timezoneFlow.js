// src/bot/handlers/chat/timezoneFlow.js

import { createTimeContext } from "../../../core/time/timeContextFactory.js";
import { isTimeNowIntent } from "../../../core/time/timeNowIntent.js";
import { isCurrentDateIntent } from "../../../core/time/currentDateIntent.js";
import { getUserTimezone, setUserTimezone } from "../../../db/userSettings.js";

function isFutureParsedHint(parsed) {
  const hint = String(parsed?.hint || "").trim();

  return (
    hint === "tomorrow" ||
    hint === "day_after_tomorrow" ||
    /_days_from_now$/.test(hint)
  );
}

export async function resolveUserTimezoneState(globalUserId) {
  let userTz = "UTC";
  let timezoneMissing = false;

  try {
    const tzInfo = await getUserTimezone(globalUserId);
    if (!tzInfo || tzInfo.isSet !== true) {
      timezoneMissing = true;
    } else {
      userTz = tzInfo.timezone || "UTC";
    }
  } catch (_) {
    timezoneMissing = true;
  }

  return {
    userTz,
    timezoneMissing,
  };
}

export async function tryHandleMissingTimezoneFlow({
  effective,
  globalUserId,
  saveAssistantEarlyReturn,
  bot,
  chatId,
}) {
  const rawTzInput = String(effective || "").trim();

  try {
    if (isTimeNowIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
      const nowUtc = timeCtx.nowUTC();
      const formatted = timeCtx.formatForUser(nowUtc);

      if (formatted) {
        const text =
          `Зараз (UTC): ${formatted}\n` +
          `Щоб показувати локальний час — вкажи часову зону IANA, напр.: Europe/Kyiv`;
        await saveAssistantEarlyReturn(text, "deterministic_time_now_utc_no_tz");
        await bot.sendMessage(chatId, text);
        return { handled: true };
      }
    }

    if (isCurrentDateIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
      const nowUtc = timeCtx.nowUTC();
      const dateOnly = timeCtx.formatDateForUser(nowUtc);

      if (dateOnly) {
        const text =
          `Сьогодні (UTC): ${dateOnly}\n` +
          `Щоб показувати локальну дату — вкажи часову зону IANA, напр.: Europe/Kyiv`;
        await saveAssistantEarlyReturn(text, "deterministic_current_date_utc_no_tz");
        await bot.sendMessage(chatId, text);
        return { handled: true };
      }
    }
  } catch (e) {
    console.error("ERROR deterministic no-tz reply failed (fail-open):", e);
  }

  const ianaCandidate = rawTzInput.match(/^[A-Za-z_]+\/[A-Za-z_]+$/) ? rawTzInput : null;

  const isValidIana = (tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
      return true;
    } catch (_) {
      return false;
    }
  };

  let resolved = null;

  if (ianaCandidate && isValidIana(ianaCandidate)) {
    resolved = ianaCandidate;
  } else {
    const t = rawTzInput.toLowerCase();

    const mentionsKyiv =
      t.includes("kyiv") || t.includes("kiev") || t.includes("київ") || t.includes("киев");

    const mentionsUkraine = t.includes("ukraine") || t.includes("украина") || t.includes("україна");

    if (mentionsKyiv || mentionsUkraine) {
      resolved = "Europe/Kyiv";
    }
  }

  if (resolved) {
    try {
      await setUserTimezone(globalUserId, resolved);
      const text = `✅ Часовий пояс збережено: ${resolved}`;
      await saveAssistantEarlyReturn(text, "timezone_saved");
      await bot.sendMessage(chatId, text);
    } catch (e) {
      console.error("ERROR setUserTimezone failed:", e);
      const text = "ERROR: Не вдалося зберегти часовий пояс. Спробуй ще раз.";
      await saveAssistantEarlyReturn(text, "timezone_save_failed");
      await bot.sendMessage(chatId, text);
    }
    return { handled: true };
  }

  {
    const text =
      "Укажи свою часову зону у форматі IANA, напр.: Europe/Kyiv. Якщо не знаєш — напиши країну і місто ще раз.";
    await saveAssistantEarlyReturn(text, "timezone_ask");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }
}

export async function tryHandleDeterministicTimeReplies({
  effective,
  userTz,
  recallCtx,
  saveAssistantEarlyReturn,
  bot,
  chatId,
}) {
  try {
    if (isTimeNowIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const formatted = timeCtx.formatForUser(nowUtc);

      const fallback =
        !formatted
          ? (() => {
              try {
                const utcCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
                return utcCtx.formatForUser(nowUtc);
              } catch (_) {
                return null;
              }
            })()
          : null;

      const out = formatted || fallback;

      if (out) {
        const text = `Зараз: ${out}`;
        await saveAssistantEarlyReturn(text, "deterministic_time_now");
        await bot.sendMessage(chatId, text);
        return { handled: true };
      }
    }
  } catch (e) {
    console.error("ERROR deterministic TIME_NOW reply failed (fail-open):", e);
  }

  try {
    if (isCurrentDateIntent(effective)) {
      const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
      const nowUtc = timeCtx.nowUTC();
      const dateOnly = timeCtx.formatDateForUser(nowUtc);

      const fallback =
        !dateOnly
          ? (() => {
              try {
                const utcCtx = createTimeContext({ userTimezoneFromDb: "UTC" });
                return utcCtx.formatDateForUser(nowUtc);
              } catch (_) {
                return null;
              }
            })()
          : null;

      const out = dateOnly || fallback;

      if (out) {
        const text = `Сьогодні: ${out}`;
        await saveAssistantEarlyReturn(text, "deterministic_current_date");
        await bot.sendMessage(chatId, text);
        return { handled: true };
      }
    }
  } catch (e) {
    console.error("ERROR deterministic CURRENT_DATE reply failed (fail-open):", e);
  }

  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);
    const qLower = String(effective || "").toLowerCase();
    const asksCalendarDate =
      qLower.includes("число") || qLower.includes("дата") || qLower.includes("what date") || qLower.includes("date was");

    const isSingleDayHint =
      parsed?.hint === "today" ||
      parsed?.hint === "tomorrow" ||
      parsed?.hint === "yesterday" ||
      parsed?.hint === "day_before_yesterday" ||
      parsed?.hint === "day_after_tomorrow" ||
      /_days_ago$/.test(String(parsed?.hint || "")) ||
      /_days_from_now$/.test(String(parsed?.hint || ""));

    if (asksCalendarDate && parsed?.fromUTC && isSingleDayHint) {
      const d = new Date(parsed.fromUTC);
      const dateOnly = timeCtx.formatDateForUser(d);

      if (dateOnly) {
        const text = `Дата: ${dateOnly}`;
        await saveAssistantEarlyReturn(text, "deterministic_calendar_date");
        await bot.sendMessage(chatId, text);
        return { handled: true };
      }

      const dateLabel = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);

      const text = `По UTC это ${dateLabel}.`;
      await saveAssistantEarlyReturn(text, "deterministic_calendar_date_fallback_utc");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }
  } catch (e) {
    console.error("ERROR deterministic calendar-date reply failed (fail-open):", e);
  }

  try {
    const timeCtx = createTimeContext({ userTimezoneFromDb: userTz });
    const parsed = timeCtx.parseHumanDate(effective);
    const isFutureSingleDay = isFutureParsedHint(parsed);

    if (parsed && !isFutureSingleDay) {
      const uaCount = (recallCtx || "").match(/U:|A:/g)?.length ?? 0;

      if (!String(recallCtx || "").trim() || uaCount < 1) {
        try {
          const text = "В памяти нет данных за этот период.";
          await saveAssistantEarlyReturn(text, "guard_recall_too_weak");
          await bot.sendMessage(chatId, text);
        } catch (e) {
          console.error("ERROR Guard send error:", e);
        }
        return { handled: true };
      }
    }
  } catch (e) {
    console.error("ERROR STAGE 8A guard failed (fail-open):", e);
  }

  return { handled: false };
}