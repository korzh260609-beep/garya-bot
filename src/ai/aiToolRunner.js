// AGENT NOTE:
// SG 2.0 AI tool runner.
// Purpose: isolate Responses API tool-round execution from callAI public wrapper.
// Do not add model routing, prompt assembly, transport logic, or GitHub approval policy here.

import { githubToolDefinitions } from "../tools/githubToolDefinitions.js";
import { runGithubTool, stringifyGithubToolResult } from "../tools/githubTool.js";
import { extractToolMetadata, mergeMetadata } from "./aiToolMetadata.js";

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

export async function runToolRound({ activeClient, model, input, maxOutputTokens, toolContext }) {
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
