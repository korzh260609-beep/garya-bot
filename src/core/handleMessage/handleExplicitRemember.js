// src/core/handleMessage/handleExplicitRemember.js

import { getMemoryService } from "../memoryServiceFactory.js";
import { buildLegacyExplicitRememberPair } from "../buildLegacyExplicitRememberPair.js";
import { buildExplicitRememberMetadata } from "../buildExplicitRememberMetadata.js";
import { buildExplicitRememberSaveRequest } from "../buildExplicitRememberSaveRequest.js";
import { buildExplicitRememberOutcome } from "../buildExplicitRememberOutcome.js";
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
    const outcome = buildExplicitRememberOutcome("remember_empty");
    await replyAndLog(outcome.replyText, outcome.replyMeta);
    return outcome.response;
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

  const rememberRequest = buildExplicitRememberSaveRequest({
    rememberKey,
    rememberValue,
    chatIdStr,
    globalUserId,
    transport,
    metadata,
  });

  try {
    const rememberRes = await memory.remember(rememberRequest);

    if (rememberRes?.ok === true && rememberRes?.stored === true) {
      const outcome = buildExplicitRememberOutcome("remember_saved", {
        memoryKey: rememberKey,
      });
      await replyAndLog(outcome.replyText, outcome.replyMeta);
      return outcome.response;
    }

    const outcome = buildExplicitRememberOutcome("remember_not_saved", {
      memoryKey: rememberKey,
    });
    await replyAndLog(outcome.replyText, outcome.replyMeta);
    return outcome.response;
  } catch (e) {
    console.error("handleMessage(explicit remember) failed:", e);

    const outcome = buildExplicitRememberOutcome("remember_error", {
      memoryKey: rememberKey,
    });
    await replyAndLog(outcome.replyText, outcome.replyMeta);
    return outcome.response;
  }
}