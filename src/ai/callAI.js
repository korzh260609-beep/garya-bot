// AGENT NOTE:
// SG 2.0 AI wrapper with runtime GitHub tools.
// Purpose: provide one controlled AI entrypoint and let the model request GitHub facts through Render env GITHUB_TOKEN.
// Do not scatter direct OpenAI calls across transport/core modules.
// Do not expose GITHUB_TOKEN in prompts, tool results, logs, or Telegram replies.

import OpenAI from "openai";
import { requireEnv } from "../config/env.js";
import { getDefaultMaxOutputTokens, getDefaultModel } from "./modelConfig.js";
import { githubToolDefinitions } from "../tools/githubToolDefinitions.js";
import { runGithubTool, stringifyGithubToolResult } from "../tools/githubTool.js";

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = requireEnv("OPENAI_API_KEY");
  client = new OpenAI({ apiKey });

  return client;
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

function parseToolArguments(raw) {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getFunctionCalls(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.filter((item) => item?.type === "function_call" && item?.name && item?.call_id);
}

function toResponseInput(messages) {
  return Array.isArray(messages)
    ? messages.map((message) => ({
        role: message?.role === "system" ? "developer" : message?.role || "user",
        content: String(message?.content ?? ""),
      }))
    : [];
}

function buildToolContext(options = {}) {
  const identity = options.identity || {};

  return {
    userId: identity.platformUserId || null,
    globalUserId: identity.globalUserId || null,
    role: identity.role || "guest",
    isMonarch: Boolean(identity.isMonarch),
    latestUserText: String(options.latestUserText || ""),
  };
}

function extractToolMetadata(toolName, result) {
  if (toolName !== "github_request") return null;

  if (result?.requires_approval && result?.approval_id && !result?.executed) {
    return {
      githubApproval: {
        approvalId: result.approval_id,
        requestHash: result.request_hash || null,
        summary: result.summary || null,
        warning: result.warning || null,
        expiresAt: result.expires_at || null,
      },
    };
  }

  return null;
}

function mergeMetadata(base = {}, patch = null) {
  if (!patch || typeof patch !== "object") return base;

  return {
    ...base,
    ...patch,
  };
}

async function runToolRound({ activeClient, model, input, maxOutputTokens, toolContext }) {
  let response = await activeClient.responses.create({
    model,
    input,
    tools: githubToolDefinitions,
    max_output_tokens: maxOutputTokens,
  });

  const maxToolRounds = 5;
  let metadata = {};

  for (let round = 0; round < maxToolRounds; round += 1) {
    const functionCalls = getFunctionCalls(response);

    if (!functionCalls.length) {
      return { response, metadata };
    }

    const toolOutputs = [];

    for (const call of functionCalls) {
      const args = parseToolArguments(call.arguments);
      const result = await runGithubTool(call.name, args, toolContext);
      metadata = mergeMetadata(metadata, extractToolMetadata(call.name, result));

      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: stringifyGithubToolResult(result),
      });
    }

    response = await activeClient.responses.create({
      model,
      input: toolOutputs,
      previous_response_id: response.id,
      tools: githubToolDefinitions,
      max_output_tokens: maxOutputTokens,
    });
  }

  return { response, metadata };
}

export async function callAI(messages, options = {}) {
  const activeClient = getClient();
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

  const text = extractOutputText(response);

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
