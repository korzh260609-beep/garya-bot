// AGENT NOTE:
// SG 2.0 minimal core message handler.
// Purpose: route normalized messages through access checks and AI without putting logic into transport.
// Do not turn this into a monolith; split capabilities as soon as new responsibilities appear.

import { checkEarlyAccess } from "../permissions/monarchGate.js";
import { callAI } from "../ai/callAI.js";

const SYSTEM_PROMPT = `
Ты — Советник GARYA / Living SG.
Отвечай коротко, ясно и критично.
Ты не являешься отдельным техническим режимом.
Ты не говоришь как raw developer console.
Ты понимаешь смысл, а не только команды.
Ты не выполняешь state-changing действия без разрешения монарха.
Если данных не хватает, скажи честно.
`;

export async function handleMessage(context = {}) {
  const text = String(context.text || "").trim();
  const userId = context.userId || context.senderId || null;

  if (!text) {
    return {
      ok: true,
      reply: "СГ получил сообщение, но текста для анализа нет.",
    };
  }

  const access = checkEarlyAccess({ userId });

  if (!access.allowed) {
    return {
      ok: false,
      reply: "СГ 2.0 сейчас доступен только монарху на этапе foundation.",
      reason: access.reason,
    };
  }

  const reply = await callAI(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    { maxOutputTokens: 500 }
  );

  return {
    ok: true,
    reply,
  };
}
