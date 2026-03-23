// src/core/handleMessage/handleExplicitRemember.js

import { getMemoryService } from "../memoryServiceFactory.js";
import {
  classifyExplicitRememberKey,
  extractExplicitRememberValue,
} from "../explicitRememberKey.js";
import { classifyMemoryCandidateV2 } from "../classifyMemoryCandidateV2.js";
import { getMemoryClassifierV2Config } from "../memoryClassifierV2Config.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function shouldRunMemoryClassifierV2Shadow() {
  try {
    const config = getMemoryClassifierV2Config();
    return config?.enabled === true && String(config?.mode || "").trim() === "shadow";
  } catch (_e) {
    return false;
  }
}

function buildShadowComparison({
  rememberRawValue,
  legacyKey,
  legacyValue,
  v2Result,
}) {
  const v2Final = v2Result?.result || {};

  return {
    input: safeStr(rememberRawValue),
    legacy: {
      key: safeStr(legacyKey),
      value: safeStr(legacyValue),
    },
    v2: {
      ok: v2Result?.ok === true,
      reason: safeStr(v2Result?.reason),
      key: safeStr(v2Final?.key),
      rememberType: safeStr(v2Final?.rememberType),
      value: safeStr(v2Final?.value),
      source: safeStr(v2Final?.source),
    },
    mismatch: {
      key: safeStr(legacyKey) !== safeStr(v2Final?.key),
      value: safeStr(legacyValue) !== safeStr(v2Final?.value),
    },
    decisionLog: v2Result?.decisionLog || null,
  };
}

function logMemoryClassifierV2Shadow(payload) {
  const hasMismatch = payload?.mismatch?.key === true || payload?.mismatch?.value === true;

  if (hasMismatch) {
    console.warn("[MEMORY_CLASSIFIER_V2_SHADOW_MISMATCH]", payload);
    return;
  }

  console.log("[MEMORY_CLASSIFIER_V2_SHADOW_MATCH]", payload);
}

export async function handleExplicitRemember({
  trimmed,
  chatIdStr,
  globalUserId,
  transport,
  senderId,
  messageId,
  userRole,
  replyAndLog,
}) {
  const explicitRememberMatch = /^(?:запомни|remember)\s+(.+)$/i.exec(trimmed);

  if (!explicitRememberMatch) {
    return { handled: false };
  }

  const memory = getMemoryService();
  const rememberRawValue = String(explicitRememberMatch[1] || "").trim();

  if (!rememberRawValue) {
    await replyAndLog("Напиши после «запомни» что именно сохранить.", {
      event: "remember_empty",
    });
    return {
      handled: true,
      response: { ok: true, stage: "7.4", result: "remember_empty" },
    };
  }

  const rememberKey = classifyExplicitRememberKey(rememberRawValue);
  const rememberValue = String(
    extractExplicitRememberValue(rememberRawValue) || rememberRawValue
  ).trim();

  // ==========================================================
  // MEMORY CLASSIFIER V2 — SHADOW MODE ONLY
  // IMPORTANT:
  // - NO runtime behavior replacement
  // - NO DB writes from V2
  // - legacy result remains authoritative for production remember()
  // - V2 used only for diagnostics / comparison
  // ==========================================================
  if (shouldRunMemoryClassifierV2Shadow()) {
    try {
      const v2Result = classifyMemoryCandidateV2({
        text: rememberRawValue,
      });

      const shadowPayload = buildShadowComparison({
        rememberRawValue,
        legacyKey: rememberKey,
        legacyValue: rememberValue,
        v2Result,
      });

      logMemoryClassifierV2Shadow(shadowPayload);
    } catch (e) {
      console.error("handleMessage(explicit remember shadow v2) failed:", e);
    }
  }

  try {
    const rememberRes = await memory.remember({
      key: rememberKey,
      value: rememberValue,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      transport,
      metadata: {
        source: "core.handleMessage.explicit_remember",
        senderId: senderId || null,
        chatId: chatIdStr,
        messageId: messageId ? Number(messageId) : null,
        userRole,
        explicitRememberRawValue: rememberRawValue,
      },
      schemaVersion: 2,
    });

    if (rememberRes?.ok === true && rememberRes?.stored === true) {
      await replyAndLog("✅ Запомнил.", {
        event: "remember_saved",
        memoryKey: rememberKey,
      });
      return {
        handled: true,
        response: { ok: true, stage: "7.4", result: "remember_saved" },
      };
    }

    await replyAndLog("⚠️ Не удалось сохранить в память.", {
      event: "remember_not_saved",
      memoryKey: rememberKey,
    });
    return {
      handled: true,
      response: { ok: false, reason: "remember_not_saved" },
    };
  } catch (e) {
    console.error("handleMessage(explicit remember) failed:", e);
    await replyAndLog("⚠️ Не удалось сохранить в память.", {
      event: "remember_error",
      memoryKey: rememberKey,
    });
    return {
      handled: true,
      response: { ok: false, reason: "remember_error" },
    };
  }
}