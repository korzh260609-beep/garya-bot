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

function resolveModelByCostLevel(costLevel = "medium") {
  if (costLevel === "nano") {
    return MODEL_CONFIG.nano || MODEL_CONFIG.low || MODEL_CONFIG.default;
  }

  if (costLevel === "low") {
    return MODEL_CONFIG.low || MODEL_CONFIG.nano || MODEL_CONFIG.default;
  }

  if (costLevel === "medium") {
    return MODEL_CONFIG.medium || MODEL_CONFIG.default;
  }

  if (costLevel === "high") {
    return MODEL_CONFIG.high || MODEL_CONFIG.medium || MODEL_CONFIG.default;
  }

  if (costLevel === "critical") {
    return MODEL_CONFIG.critical || MODEL_CONFIG.high || MODEL_CONFIG.default;
  }

  return MODEL_CONFIG.default;
}

function resolveFallbackModels({ costLevel = "medium", primaryModel = null } = {}) {
  const chainByCostLevel = {
    nano: [MODEL_CONFIG.low, MODEL_CONFIG.legacyFallback],
    low: [MODEL_CONFIG.nano, MODEL_CONFIG.legacyFallback],
    medium: [MODEL_CONFIG.low, MODEL_CONFIG.nano, MODEL_CONFIG.legacyFallback],
    high: [MODEL_CONFIG.medium, MODEL_CONFIG.low, MODEL_CONFIG.legacyFallback],
    critical: [MODEL_CONFIG.high, MODEL_CONFIG.medium, MODEL_CONFIG.low, MODEL_CONFIG.legacyFallback],
  };

  const chain = chainByCostLevel[costLevel] || [MODEL_CONFIG.low, MODEL_CONFIG.legacyFallback];
  const seen = new Set([primaryModel].filter(Boolean));

  return chain.filter((model) => {
    if (!model || seen.has(model)) return false;
    seen.add(model);
    return true;
  });
}

function isGpt5Model(model) {
  return /^gpt-5(?:[.-]|$)/i.test(String(model || "").trim());
}

function resolveTemperatureForModel(model, temperature) {
  if (typeof temperature !== "number") {
    return undefined;
  }

  if (isGpt5Model(model)) {
    return undefined;
  }

  return temperature;
}

function extractOutputText(response) {
  if (
    typeof response?.output_text === "string" &&
    response.output_text.trim().length
  ) {
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

    const joined = texts.join("\n");
    if (joined.trim().length) {
      return joined;
    }
  }

  return "";
}

function readUsdPerMillionEnv(model, kind) {
  const normalizedModel = String(model || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

  if (!normalizedModel) return null;

  const raw = envStr(`AI_PRICE_${normalizedModel}_${kind}_USD_PER_1M`, "").trim();
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizeUsage(response) {
  const usage = response?.usage || {};

  const inputTokens = Number.isFinite(Number(usage?.input_tokens))
    ? Number(usage.input_tokens)
    : Number.isFinite(Number(usage?.prompt_tokens))
      ? Number(usage.prompt_tokens)
      : null;

  const outputTokens = Number.isFinite(Number(usage?.output_tokens))
    ? Number(usage.output_tokens)
    : Number.isFinite(Number(usage?.completion_tokens))
      ? Number(usage.completion_tokens)
      : null;

  const totalTokens = Number.isFinite(Number(usage?.total_tokens))
    ? Number(usage.total_tokens)
    : Number.isFinite(inputTokens) && Number.isFinite(outputTokens)
      ? inputTokens + outputTokens
      : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    raw: usage || null,
  };
}

function estimateUsageCostUsd({ model, inputTokens, outputTokens }) {
  const inputUsdPer1M = readUsdPerMillionEnv(model, "INPUT");
  const outputUsdPer1M = readUsdPerMillionEnv(model, "OUTPUT");

  if (
    !Number.isFinite(inputTokens) ||
    !Number.isFinite(outputTokens) ||
    !Number.isFinite(inputUsdPer1M) ||
    !Number.isFinite(outputUsdPer1M)
  ) {
    return {
      estimatedUsd: null,
      inputUsdPer1M,
      outputUsdPer1M,
      pricingConfigured: false,
    };
  }

  const estimatedUsd =
    (inputTokens / 1_000_000) * inputUsdPer1M +
    (outputTokens / 1_000_000) * outputUsdPer1M;

  return {
    estimatedUsd,
    inputUsdPer1M,
    outputUsdPer1M,
    pricingConfigured: true,
  };
}

function buildInputPayload(messages, primaryModel, maxTok, temperature) {
  const input = Array.isArray(messages)
    ? messages.map((m) => ({
        role: m?.role === "system" ? "developer" : m?.role || "user",
        content: m?.content ?? "",
      }))
    : [];

  const resolvedTemperature = resolveTemperatureForModel(primaryModel, temperature);

  const payload = {
    model: primaryModel,
    input,
    ...(typeof maxTok === "number" ? { max_output_tokens: maxTok } : {}),
    ...(typeof resolvedTemperature === "number" ? { temperature: resolvedTemperature } : {}),
  };

  return { input, payload };
}

function buildAiUsageResult({ response, text, model, costLevel, usedFallback, fallbackFromModel = null }) {
  const usage = normalizeUsage(response);
  const cost = estimateUsageCostUsd({
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });

  return {
    text,
    model,
    costLevel,
    usedFallback: usedFallback === true,
    fallbackFromModel,
    usage,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedUsd: cost.estimatedUsd,
    pricingConfigured: cost.pricingConfigured,
    inputUsdPer1M: cost.inputUsdPer1M,
    outputUsdPer1M: cost.outputUsdPer1M,
  };
}

async function runResponsesCreate({ model, input, maxTok, temperature }) {
  const resolvedTemperature = resolveTemperatureForModel(model, temperature);

  const payload = {
    model,
    input,
    ...(typeof maxTok === "number" ? { max_output_tokens: maxTok } : {}),
    ...(typeof resolvedTemperature === "number" ? { temperature: resolvedTemperature } : {}),
  };

  const response = await client.responses.create(payload);
  const text = extractOutputText(response);

  if (text.trim().length) {
    return { response, text };
  }

  throw new Error(`AI returned empty output (model=${model})`);
}

/**
 * Универсальный вызов ИИ с usage/cost metadata.
 * Поддерживает opts: { max_completion_tokens, max_output_tokens, temperature }.
 *
 * ВАЖНО:
 * - Для gpt-5.* используем Responses API + max_output_tokens.
 * - НЕ используем max_tokens (он вызывает 400 "Unsupported parameter").
 * - Для gpt-5.* НЕ передаём temperature, потому что часть GPT-5 response-моделей
 *   отклоняет этот параметр с 400 "Unsupported parameter".
 * - Стоимость считается только если заданы ENV:
 *   AI_PRICE_<MODEL>_INPUT_USD_PER_1M
 *   AI_PRICE_<MODEL>_OUTPUT_USD_PER_1M
 *   пример для gpt-5-nano:
 *   AI_PRICE_GPT_5_NANO_INPUT_USD_PER_1M
 *   AI_PRICE_GPT_5_NANO_OUTPUT_USD_PER_1M
 */
export async function callAIWithUsage(messages, costLevel = "medium", opts = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY missing (Render env not set / not loaded)");
  }

  const primaryModel = resolveModelByCostLevel(costLevel);

  const maxTok =
    typeof opts.max_completion_tokens === "number"
      ? opts.max_completion_tokens
      : typeof opts.max_output_tokens === "number"
      ? opts.max_output_tokens
      : undefined;

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : undefined;

  const { input } = buildInputPayload(messages, primaryModel, maxTok, temperature);

  try {
    const { response, text } = await runResponsesCreate({
      model: primaryModel,
      input,
      maxTok,
      temperature,
    });

    return buildAiUsageResult({
      response,
      text,
      model: primaryModel,
      costLevel,
      usedFallback: false,
    });
  } catch (e) {
    const status = e?.status || e?.statusCode || null;
    const msg = e?.message || String(e);

    console.error("❌ callAI primary failed:", {
      requestedCostLevel: costLevel,
      model: primaryModel,
      status,
      msg,
    });

    const fallbackModels = resolveFallbackModels({ costLevel, primaryModel });
    let lastError = e;

    for (const fallbackModel of fallbackModels) {
      try {
        const { response, text } = await runResponsesCreate({
          model: fallbackModel,
          input,
          maxTok,
          temperature,
        });

        return buildAiUsageResult({
          response,
          text,
          model: fallbackModel,
          costLevel,
          usedFallback: true,
          fallbackFromModel: primaryModel,
        });
      } catch (fallbackError) {
        lastError = fallbackError;
        console.error("❌ callAI fallback failed:", {
          requestedCostLevel: costLevel,
          primaryModel,
          fallbackModel,
          status: fallbackError?.status || fallbackError?.statusCode || null,
          msg: fallbackError?.message || String(fallbackError),
        });
      }
    }

    throw lastError;
  }
}

/**
 * Универсальный вызов ИИ.
 * Backward-compatible wrapper: старый контракт возвращает только строку.
 */
export async function callAI(messages, costLevel = "medium", opts = {}) {
  const result = await callAIWithUsage(messages, costLevel, opts);
  return result.text;
}