import OpenAI from "openai";
import { MODEL_CONFIG } from "./modelConfig.js";

/**
 * OpenAI client.
 * ВАЖНО: если ключа нет — не создаём клиент, чтобы ошибка была явной и читаемой.
 */
const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Универсальный вызов ИИ.
 * Поддерживает opts: { max_output_tokens, temperature }.
 * Делает fallback на MODEL_CONFIG.low, если выбранная модель недоступна.
 */
export async function callAI(messages, costLevel = "high", opts = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY missing (Render env not set / not loaded)");
  }

  const primaryModel =
    costLevel === "low" ? MODEL_CONFIG.low : MODEL_CONFIG.default;

  const fallbackModel = MODEL_CONFIG.low;

  // chat.completions использует max_tokens (а не max_output_tokens).
  const maxTokens =
    typeof opts.max_output_tokens === "number" ? opts.max_output_tokens : undefined;

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : undefined;

  const payload = {
    model: primaryModel,
    messages,
    ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
  };

  try {
    const completion = await client.chat.completions.create(payload);
    return completion.choices[0]?.message?.content || "";
  } catch (e) {
    // Логируем причину для Render Logs
    const status = e?.status || e?.statusCode || null;
    const msg = e?.message || String(e);
    console.error("❌ callAI primary failed:", { model: primaryModel, status, msg });

    // Если уже low — больше некуда фолбечиться
    if (primaryModel === fallbackModel) throw e;

    const completion = await client.chat.completions.create({
      model: fallbackModel,
      messages,
      ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    });

    return completion.choices[0]?.message?.content || "";
  }
}
