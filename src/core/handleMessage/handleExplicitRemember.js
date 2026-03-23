// src/core/handleMessage/handleExplicitRemember.js

import { getMemoryService } from "../memoryServiceFactory.js";
import {
  classifyExplicitRememberKey,
  extractExplicitRememberValue,
} from "../explicitRememberKey.js";
import { classifyMemoryCandidateV2 } from "../classifyMemoryCandidateV2.js";
import { getMemoryClassifierV2Config } from "../memoryClassifierV2Config.js";
import { isMemoryClassifierV2SafeAdoptionKey } from "../memoryClassifierV2AdoptionConfig.js";
import { getMemoryClassifierV2ShadowLogConfig } from "../memoryClassifierV2ShadowLogConfig.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function getMemoryClassifierV2RuntimeConfig() {
  try {
    const config = getMemoryClassifierV2Config();
    return {
      enabled: config?.enabled === true,
      mode: String(config?.mode || "").trim() || "shadow",
    };
  } catch (_e) {
    return {
      enabled: false,
      mode: "shadow",
    };
  }
}

function shouldRunMemoryClassifierV2Shadow(runtimeConfig) {
  return runtimeConfig?.enabled === true;
}

function shouldAllowMemoryClassifierV2Adoption(runtimeConfig) {
  return (
    runtimeConfig?.enabled === true &&
    String(runtimeConfig?.mode || "").trim() === "hybrid_safe_keys"
  );
}

function isSafeV2AdoptionCandidate(v2Result) {
  const key = safeStr(v2Result?.result?.key).trim();
  const value = safeStr(v2Result?.result?.value).trim();

  if (!key || !value) {
    return false;
  }

  return isMemoryClassifierV2SafeAdoptionKey(key);
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

function buildCompactShadowLogPayload(payload) {
  return {
    input: safeStr(payload?.input),
    legacy: {
      key: safeStr(payload?.legacy?.key),
      value: safeStr(payload?.legacy?.value),
    },
    v2: {
      ok: payload?.v2?.ok === true,
      reason: safeStr(payload?.v2?.reason),
      key: safeStr(payload?.v2?.key),
      rememberType: safeStr(payload?.v2?.rememberType),
      value: safeStr(payload?.v2?.value),
      source: safeStr(payload?.v2?.source),
    },
    mismatch: {
      key: payload?.mismatch?.key === true,
      value: payload?.mismatch?.value === true,
    },
  };
}

function logMemoryClassifierV2Shadow(payload) {
  const logConfig = getMemoryClassifierV2ShadowLogConfig();

  if (logConfig?.enabled !== true) {
    return;
  }

  if (String(logConfig?.mode || "").trim() === "off") {
    return;
  }

  const hasMismatch =
    payload?.mismatch?.key === true || payload?.mismatch?.value === true;

  const finalPayload =
    String(logConfig?.mode || "").trim() === "full"
      ? payload
      : buildCompactShadowLogPayload(payload);

  if (hasMismatch) {
    console.warn("[MEMORY_CLASSIFIER_V2_SHADOW_MISMATCH]", finalPayload);
    return;
  }

  console.log("[MEMORY_CLASSIFIER_V2_SHADOW_MATCH]", finalPayload);
}

function buildRememberPlan({
  legacyKey,
  legacyValue,
  v2Result,
  runtimeConfig,
}) {
  const legacyPlan = {
    rememberKey: safeStr(legacyKey).trim(),
    rememberValue: safeStr(legacyValue).trim(),
    selectedBy: "legacy",
  };

  if (!shouldAllowMemoryClassifierV2Adoption(runtimeConfig)) {
    return legacyPlan;
  }

  if (v2Result?.ok !== true) {
    return legacyPlan;
  }

  if (!isSafeV2AdoptionCandidate(v2Result)) {
    return legacyPlan;
  }

  const v2Key = safeStr(v2Result?.result?.key).trim();
  const v2Value = safeStr(v2Result?.result?.value).trim();

  if (!v2Key || !v2Value) {
    return legacyPlan;
  }

  return {
    rememberKey: v2Key,
    rememberValue: v2Value,
    selectedBy: "v2_safe_adoption",
  };
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

  const runtimeConfig = getMemoryClassifierV2RuntimeConfig();

  const legacyRememberKey = classifyExplicitRememberKey(rememberRawValue);
  const legacyRememberValue = String(
    extractExplicitRememberValue(rememberRawValue) || rememberRawValue
  ).trim();

  let v2Result = null;

  if (shouldRunMemoryClassifierV2Shadow(runtimeConfig)) {
    try {
      v2Result = classifyMemoryCandidateV2({
        text: rememberRawValue,
      });

      const shadowPayload = buildShadowComparison({
        rememberRawValue,
        legacyKey: legacyRememberKey,
        legacyValue: legacyRememberValue,
        v2Result,
      });

      logMemoryClassifierV2Shadow(shadowPayload);
    } catch (e) {
      console.error("handleMessage(explicit remember shadow v2) failed:", e);
    }
  }

  const rememberPlan = buildRememberPlan({
    legacyKey: legacyRememberKey,
    legacyValue: legacyRememberValue,
    v2Result,
    runtimeConfig,
  });

  const rememberKey = rememberPlan.rememberKey;
  const rememberValue = rememberPlan.rememberValue;

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
        classifierVersion:
          rememberPlan.selectedBy === "v2_safe_adoption" ? "v2" : "legacy",
        classifierMode: runtimeConfig.mode,
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