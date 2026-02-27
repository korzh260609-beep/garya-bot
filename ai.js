import OpenAI from "openai";
import { MODEL_CONFIG } from "./modelConfig.js";
import { envStr } from "./src/core/config.js";

/**
 * OpenAI client.
 * ВАЖНО: если ключа нет — не создаём клиент, чтобы ошибка была явной и читаемой.
 */

// ✅ Stage 3.6 hygiene — no direct process.env
const apiKey = envStr("OPENAI_API_KEY", "").trim();
const client = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Универсальный вызов ИИ.
 * Поддерживает opts: { max_completion_tokens, max_output_tokens, temperature }.
 *
 * ВАЖНО:
 * - Для gpt-5.* используем Responses API + max_output_tokens.
 * - НЕ используем max_tokens (он вызывает 400 "Unsupported parameter").
 */
export async function callAI(messages, costLevel = "high", opts = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY missing (Render env not set / not loaded)");
  }

  const primaryModel =
    costLevel === "low" ? MODEL_CONFIG.low : MODEL_CONFIG.default;

  const fallbackModel = MODEL_CONFIG.low;

  const maxTok =
    typeof opts.max_completion_tokens === "number"
      ? opts.max_completion_tokens
      : typeof opts.max_output_tokens === "number"
      ? opts.max_output_tokens
      : undefined;

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : undefined;

  const input = Array.isArray(messages)
    ? messages.map((m) => ({
        role: m?.role === "system" ? "developer" : m?.role || "user",
        content: m?.content ?? "",
      }))
    : [];

  const payload = {
    model: primaryModel,
    input,
    ...(typeof maxTok === "number" ? { max_output_tokens: maxTok } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
  };

  try {
    const response = await client.responses.create(payload);

    if (typeof response?.output_text === "string" && response.output_text.length) {
      return response.output_text;
    }

    const out = response?.output;
    if (Array.isArray(out)) {
      const texts = [];
      for (const item of out) {
        if (item?.type === "message" && Array.isArray(item?.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text" && typeof c?.text === "string") {
              texts.push(c.text);
            }
          }
        }
      }
      if (texts.length) return texts.join("\n");
    }

    return "";
  } catch (e) {
    const status = e?.status || e?.statusCode || null;
    const msg = e?.message || String(e);

    console.error("❌ callAI primary failed:", {
      model: primaryModel,
      status,
      msg,
    });

    if (primaryModel === fallbackModel) throw e;

    const fallbackPayload = {
      model: fallbackModel,
      input,
      ...(typeof maxTok === "number" ? { max_output_tokens: maxTok } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    };

    const response = await client.responses.create(fallbackPayload);

    if (typeof response?.output_text === "string" && response.output_text.length) {
      return response.output_text;
    }

    const out = response?.output;
    if (Array.isArray(out)) {
      const texts = [];
      for (const item of out) {
        if (item?.type === "message" && Array.isArray(item?.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text" && typeof c?.text === "string") {
              texts.push(c.text);
            }
          }
        }
      }
      if (texts.length) return texts.join("\n");
    }

    return "";
  }
}
