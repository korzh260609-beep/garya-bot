// AGENT NOTE:
// SG 2.0 prompt runtime context section.
// Purpose: wrap project runtime context formatting without changing runtime context internals.
// Do not hardcode project defaults here.

import { formatProjectRuntimeContext } from "../projectRuntimeContext.js";

export function formatPromptRuntimeContext() {
  return `
Runtime context:
${formatProjectRuntimeContext()}
`.trim();
}
