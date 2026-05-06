// AGENT NOTE:
// SG 2.0 message AI request builder.
// Purpose: isolate AI request construction for normal text messages from handleMessage.
// Do not add OpenAI client logic, tool execution, transport logic, or access checks here.

import { callAI } from "../../ai/callAI.js";
import { buildSgSystemPrompt } from "../sgSystemPrompt.js";

export async function callMessageAI({ identity, text, behaviorRuntime }) {
  return callAI(
    [
      { role: "system", content: buildSgSystemPrompt(identity) },
      { role: "user", content: text },
    ],
    {
      maxOutputTokens: 500,
      identity,
      latestUserText: text,
      behaviorRuntime,
      returnMetadata: true,
    }
  );
}
