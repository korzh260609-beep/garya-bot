import OpenAI from "openai";
import { MODEL_CONFIG } from "./modelConfig.js";

const apiKey = process.env.OPENAI_API_KEY;

// Не создаём client без ключа — иначе будут "тихие" падения.
const client = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Универсальный вызов ИИ.
 * - costLevel: "low" | "high"
 * - opts: { max_output_tokens, temperature } (опционально)
 *
 * Поведение:
 * 1) Пытаемся primary-модель (default или low)
 * 2) Если primary недоступна/ошибка — fallback на MODEL_CONFIG.low
 */
export async function callAI(messages, costLevel = "high", opts = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY is missing in environment");
  }

  const primaryModel =
    costLevel === "low" ? MODEL_CONFIG.low : MODEL_CONFIG.default;

  const fallbackModel = MODEL_CONFIG.low;

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : undefined;

  // Для chat.completions используется max_tokens.
  // opts.max_output_tokens (как в Responses API) маппим на max_tokens.
  const maxTokens =
    typeof opts.max_output_tokens === "number" ? opts.max_output_tokens : undefined;

  const payloadBase = {
    messages,
    ...(typeof temperature === "number" ? { temperature } : {}),
    ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
  };

  try {
    const completion = await client.chat.completions.create({
      model: primaryModel,
      ...payloadBase,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (e) {
    const status = e?.status || e?.statusCode || null;
    const msg = e?.message || String(e);
    console.error("❌ callAI primary failed:", { model: primaryModel, status, msg });

    if (primaryModel === fallbackModel) throw e;

    const completion = await client.chat.completions.create({
      model: fallbackModel,
      ...payloadBase,
    });
    return completion.choices[0]?.message?.content || "";
  }
}
