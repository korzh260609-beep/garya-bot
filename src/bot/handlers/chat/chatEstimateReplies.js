// src/bot/handlers/chat/chatEstimateReplies.js

import { saveActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";
import { resolveEstimateFocus } from "./chatEstimateFocus.js";
import {
  buildEstimateReplyText,
  buildEstimateReplyTextByFocus,
  buildEstimateFollowUpReplyText,
} from "./chatEstimateTextBuilders.js";

export function saveSuccessfulEstimateContext({
  chatId,
  estimate,
  chatIdStr,
  messageId,
  reason,
}) {
  if (!estimate?.ok) return null;

  return saveActiveEstimateContext({
    chatId,
    estimate,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "document_chat_estimate"),
    },
  });
}

export {
  buildEstimateReplyText,
  buildEstimateReplyTextByFocus,
  buildEstimateFollowUpReplyText,
  resolveEstimateFocus,
};

export default {
  buildEstimateReplyText,
  buildEstimateReplyTextByFocus,
  buildEstimateFollowUpReplyText,
  saveSuccessfulEstimateContext,
  resolveEstimateFocus,
};
