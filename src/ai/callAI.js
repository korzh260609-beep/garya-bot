// AGENT NOTE:
// SG 2.0 minimal AI wrapper.
// Purpose: provide one controlled AI entrypoint for the first speaking SG.
// Do not scatter direct OpenAI calls across transport/core modules.

import OpenAI from "openai";
import { envStr } from "../config/env.js";

function getClient() {
  const apiKey = envStr("OPENAI_API_KEY", "").trim();

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const chunks = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export async function callAI(messages, options = {}) {
  const client = getClient();

  if (!client) {
    return "СГ ещё не подключён к AI: отсутствует OPENAI_API_KEY.";
  }

  const model = options.model || envStr("OPENAI_MODEL", "gpt-4.1-mini").trim();

  const input = Array.isArray(messages)
    ? messages.map((message) => ({
        role: message?.role === "system" ? "developer" : message?.role || "user",
        content: String(message?.content ?? ""),
      }))
    : [];

  const response = await client.responses.create({
    model,
    input,
    max_output_tokens: options.maxOutputTokens || 500,
  });

  const text = extractOutputText(response);

  if (!text) {
    return "СГ получил пустой ответ от AI. Нужно проверить модель или ключ.";
  }

  return text;
}
