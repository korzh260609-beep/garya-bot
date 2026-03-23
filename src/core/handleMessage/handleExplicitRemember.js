// src/core/handleMessage/handleExplicitRemember.js

import { getMemoryService } from "../memoryServiceFactory.js";
import { buildLegacyExplicitRememberPair } from "../buildLegacyExplicitRememberPair.js";
import { buildExplicitRememberMetadata } from "../buildExplicitRememberMetadata.js";
import {
  buildRememberPlan,
  getMemoryClassifierV2RuntimeConfig,
} from "../memoryClassifierV2RuntimeDecision.js";
import { runExplicitRememberV2Shadow } from "../runExplicitRememberV2Shadow.js";

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

  const { legacyRememberKey, legacyRememberValue } =
    buildLegacyExplicitRememberPair(rememberRawValue);

  const v2Result = runExplicitRememberV2Shadow({
    rememberRawValue,
    legacyKey: legacyRememberKey,
    legacyValue: legacyRememberValue,
    runtimeConfig,
  });

  const rememberPlan = buildRememberPlan({
    legacyKey: legacyRememberKey,
    legacyValue: legacyRememberValue,
    v2Result,
    runtimeConfig,
  });

  const rememberKey = rememberPlan.rememberKey;
  const rememberValue = rememberPlan.rememberValue;

  const metadata = buildExplicitRememberMetadata({
    chatIdStr,
    senderId,
    messageId,
    userRole,
    rememberRawValue,
    rememberPlan,
    runtimeConfig,
  });

  try {
    const rememberRes = await memory.remember({
      key: rememberKey,
      value: rememberValue,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      transport,
      metadata,
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