// AGENT NOTE:
// SG 2.0 simple Render request runner.
// Purpose: one request in, one safe response out.
// Do not add polling, Telegram handlers, GitHub writes, deploys, restarts, or env mutation here.

import renderRequestProcessor from "./renderRequestProcessor.js";

function parseRequest(input) {
  if (typeof input === "string") {
    return JSON.parse(input);
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input;
  }

  throw new Error("render_request_input_invalid");
}

export async function runRenderRequest(input) {
  const request = parseRequest(input);
  return renderRequestProcessor.process(request);
}

export function buildRenderResponseJson(response) {
  return `${JSON.stringify(response, null, 2)}\n`;
}

export async function runRenderRequestToJson(input) {
  const response = await runRenderRequest(input);
  return buildRenderResponseJson(response);
}

export default {
  runRenderRequest,
  runRenderRequestToJson,
  buildRenderResponseJson,
};
