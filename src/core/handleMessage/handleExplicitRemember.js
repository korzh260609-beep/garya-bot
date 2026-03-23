// src/core/handleMessage/handleExplicitRemember.js

import { getMemoryService } from "../memoryServiceFactory.js";
import {
  classifyExplicitRememberKey,
  extractExplicitRememberValue,
} from "../explicitRememberKey.js";
import { classifyMemoryCandidateV2 } from "../classifyMemoryCandidateV2.js";
import {
  buildRememberPlan,
  buildShadowComparison,
  getMemoryClassifierV2RuntimeConfig,
  logMemoryClassifierV2Shadow,
  shouldRunMemoryClassifierV2Shadow,
} from "../memoryClassifierV2RuntimeDecision.js";

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