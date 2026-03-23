// src/core/buildExplicitRememberOutcome.js
//
// Goal:
// - centralize explicit-remember outcome payloads
// - keep behavior identical
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT save memory
// - this helper does NOT run V2
// - this helper only builds reply/result payloads

export function buildExplicitRememberOutcome(type, { memoryKey } = {}) {
  if (type === "remember_empty") {
    return {
      replyText: "Напиши после «запомни» что именно сохранить.",
      replyMeta: {
        event: "remember_empty",
      },
      response: {
        handled: true,
        response: { ok: true, stage: "7.4", result: "remember_empty" },
      },
    };
  }

  if (type === "remember_saved") {
    return {
      replyText: "✅ Запомнил.",
      replyMeta: {
        event: "remember_saved",
        memoryKey,
      },
      response: {
        handled: true,
        response: { ok: true, stage: "7.4", result: "remember_saved" },
      },
    };
  }

  if (type === "remember_not_saved") {
    return {
      replyText: "⚠️ Не удалось сохранить в память.",
      replyMeta: {
        event: "remember_not_saved",
        memoryKey,
      },
      response: {
        handled: true,
        response: { ok: false, reason: "remember_not_saved" },
      },
    };
  }

  return {
    replyText: "⚠️ Не удалось сохранить в память.",
    replyMeta: {
      event: "remember_error",
      memoryKey,
    },
    response: {
      handled: true,
      response: { ok: false, reason: "remember_error" },
    },
  };
}

export default buildExplicitRememberOutcome;