// AGENT NOTE:
// SG 2.0 system prompt boundary.
// Purpose: assemble Living SG identity and core behavior from prompt modules.
// Do not turn this into a giant prompt dump or replace future source/pillars loading with hardcoded text.

import { formatBehaviorPrompt } from "../behavior/behaviorPrompt.js";
import {
  formatPromptBehaviorRules,
  formatPromptGithubOutputFormat,
  formatPromptGithubRuntime,
  formatPromptGithubWritePolicy,
  formatPromptIdentity,
  formatPromptLanguageRules,
  formatPromptRuntimeContext,
  formatPromptRuntimeStatus,
} from "./prompt/index.js";

export function buildSgSystemPrompt(identity = {}) {
  const behaviorPrompt = formatBehaviorPrompt();

  return `
${formatPromptIdentity(identity)}

${behaviorPrompt}

${formatPromptBehaviorRules()}

${formatPromptLanguageRules()}

${formatPromptRuntimeContext()}

${formatPromptGithubRuntime()}

${formatPromptGithubWritePolicy()}

${formatPromptGithubOutputFormat()}

${formatPromptRuntimeStatus()}
`.trim();
}
