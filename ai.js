import OpenAI from "openai";
import { MODEL_CONFIG } from "./modelConfig.js";

/**
 * OpenAI client.
 * ВАЖНО: если ключа нет — не создаём клиент, чтобы ошибка была явной и читаемой.
 */
const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Определяем правильный параметр лимита токенов по модели.
 * gpt-5.* требует max_completion_tokens (и не принимает max_tokens).
 * Более старые chat.completions модели обычно используют max_tokens.
 */
function getTokenLimitParamName(model) {
  const m = String(model || "");
  if (m.startsWith("gpt-5")) return "max_completion_tokens";
  return "max_tokens";
}

/**
 * Универсальный вызов ИИ.
 * Поддерживает opts: { max_completion_tokens, max_output_tokens, temperature }.
 * Делает fallback на MODEL_CONFIG.low, если выбранная модель недоступна.
 */
export async function callAI(messages, costLevel = "high", opts = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY missing (Render env not set / not loaded)");
  }

  const primaryModel =
    costLevel === "low" ? MODEL_CONFIG.low : MODEL_CONFIG.default;

  const fallbackModel = MODEL_CONFIG.low;

  // Поддержка двух имён (чтобы не ломать старые вызовы):
  // - max_completion_tokens (новое)
  // - max_output_tokens (старое в проекте)
  const maxTok =
    typeof opts.max_completion_tokens === "number"
      ? opts.max_completion_tokens
      : typeof opts.max_output_tokens === "number"
      ? opts.max_output_tokens
      : undefined;

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : undefined;

  const tokenParamName = getTokenLimitParamName(primaryModel);

  const payload = {
    model: primaryModel,
    messages,
    ...(typeof maxTok === "number" ? { [tokenParamName]: maxTok } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
  };

  try {
    const completion = await client.chat.completions.create(payload);
    return completion.choices[0]?.message?.content || "";
  } catch (e) {
    const status = e?.status || e?.statusCode || null;
    const msg = e?.message || String(e);
    console.error("❌ callAI primary failed:", { model: primaryModel, status, msg });

    // Если уже low — больше некуда фолбечиться
    if (primaryModel === fallbackModel) throw e;

    const fallbackTokenParamName = getTokenLimitParamName(fallbackModel);

    const completion = await client.chat.completions.create({
      model: fallbackModel,
      messages,
      ...(typeof maxTok === "number" ? { [fallbackTokenParamName]: maxTok } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    });

    return completion.choices[0]?.message?.content || "";
  }
}
