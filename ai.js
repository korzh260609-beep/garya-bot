import OpenAI from "openai";
import { MODEL_CONFIG } from "./modelConfig.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Универсальный вызов ИИ.
 * Пока всегда использует модель MODEL_CONFIG.default = gpt-5.1.
 */
export async function callAI(messages, costLevel = "high") {
  const model =
    costLevel === "low" ? MODEL_CONFIG.low : MODEL_CONFIG.default;

  const completion = await client.chat.completions.create({
    model,
    messages,
  });

  return completion.choices[0]?.message?.content || "";
}
