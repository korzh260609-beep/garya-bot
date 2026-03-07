// src/bot/handlers/decisionPromotionDiag.js

import {
  getDecisionPromotionCandidates,
  getDecisionPromotionBlocklist,
} from "../../decision/decisionPromotionPolicy.js";

export async function handleDecisionPromotionDiag({ bot, chatId, reply }) {
  const candidates = getDecisionPromotionCandidates();
  const blocked = getDecisionPromotionBlocklist();

  const text = [
    "🧠 DECISION PROMOTION POLICY",
    "",
    "candidates:",
    ...candidates.map((x) => `- ${x}`),
    "",
    "blocked:",
    ...blocked.map((x) => `- ${x}`),
  ].join("\n");

  if (typeof reply === "function") {
    await reply(text, {
      cmd: "/diag_decision_promotion",
      handler: "handleDecisionPromotionDiag",
    });
    return;
  }

  await bot.sendMessage(chatId, text);
}