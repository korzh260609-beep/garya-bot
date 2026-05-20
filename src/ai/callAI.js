// AGENT NOTE:
// SG 2.0 AI wrapper with runtime GitHub tools.
// Purpose: provide one controlled AI entrypoint and delegate AI-layer responsibilities to focused modules.
// Do not scatter direct OpenAI calls across transport/core modules.
// Do not expose GITHUB_TOKEN in prompts, tool results, logs, or Telegram replies.

import { buildToolContext } from "./aiToolContext.js";
import { toResponseInput } from "./aiInputMapper.js";
import { extractOutputText } from "./aiOutputParser.js";
import { runToolRound } from "./aiToolRunner.js";
import { getDefaultMaxOutputTokens, getDefaultModel } from "./modelConfig.js";
import { getOpenAIClient } from "./openaiClient.js";

const AUTHORITATIVE_FINAL_TEXT_SOURCES = new Set([
  "sg_diagnostics_check",
  "render_collect_logs",
  "render_collect_env",
]);

function getAuthoritativeToolFinalText(metadata = {}) {
  if (
    AUTHORITATIVE_FINAL_TEXT_SOURCES.has(metadata?.finalTextSource)
    && typeof metadata.finalText === "string"
    && metadata.finalText.trim()
  ) {
    return metadata.finalText.trim();
  }

  return "";
}

export async function callAI(messages, options = {}) {
  const activeClient = getOpenAIClient();
  const model = options.model || getDefaultModel();
  const maxOutputTokens = options.maxOutputTokens || getDefaultMaxOutputTokens();
  const input = toResponseInput(messages);
  const toolContext = buildToolContext(options);

  const { response, metadata } = await runToolRound({
    activeClient,
    model,
    input,
    maxOutputTokens,
    toolContext,
  });

  const authoritativeToolFinalText = getAuthoritativeToolFinalText(metadata);
  const text = authoritativeToolFinalText || extractOutputText(response) || metadata?.finalText || "";

  if (!text) {
    throw new Error("AI returned empty output");
  }

  if (options.returnMetadata) {
    return {
      text,
      metadata,
    };
  }

  return text;
}
