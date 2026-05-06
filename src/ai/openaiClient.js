// AGENT NOTE:
// SG 2.0 OpenAI client factory.
// Purpose: keep OpenAI client initialization in one controlled AI-layer module.
// Do not add tool execution, prompt assembly, transport logic, or business rules here.

import OpenAI from "openai";
import { requireEnv } from "../config/env.js";

let client = null;

export function getOpenAIClient() {
  if (client) return client;

  const apiKey = requireEnv("OPENAI_API_KEY");
  client = new OpenAI({ apiKey });

  return client;
}
