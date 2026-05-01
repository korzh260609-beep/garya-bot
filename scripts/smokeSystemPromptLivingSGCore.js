// scripts/smokeSystemPromptLivingSGCore.js
// ============================================================================
// SYSTEM PROMPT LIVING SG CORE SMOKE CHECK
//
// Purpose:
// - verify that Living SG behavior core reaches the real system prompt;
// - verify that the system prompt keeps SG as the global Advisor system;
// - verify that behavior core does not connect repo/tool capabilities;
// - does not call AI;
// - does not read/write repo/runtime state.
// ============================================================================

import { buildSystemPrompt } from "../systemPrompt.js";

function assertIncludes(name, value, expectedPart) {
  const text = String(value || "");
  if (!text.includes(expectedPart)) {
    throw new Error(`System prompt Living SG smoke check failed: ${name}: missing ${expectedPart}`);
  }
}

function assertNotIncludes(name, value, forbiddenPart) {
  const text = String(value || "");
  if (text.includes(forbiddenPart)) {
    throw new Error(`System prompt Living SG smoke check failed: ${name}: forbidden ${forbiddenPart}`);
  }
}

const prompt = buildSystemPrompt(
  "normal",
  "Режим normal: test.",
  "",
  {
    isMonarch: true,
    currentUserName: "GARY",
    userText: "что мы сейчас делаем по живому слою СГ?",
  }
);

assertIncludes("prompt", prompt, "Ты — ИИ-Советник Королевства GARYA");
assertIncludes("prompt", prompt, "Текущий пользователь: MONARCH (GARY).");
assertIncludes("prompt", prompt, "BEHAVIOR CORE:");
assertIncludes("prompt", prompt, "LIVING SG:");
assertIncludes("prompt", prompt, "global Advisor system");
assertIncludes("prompt", prompt, "not a command bot");
assertIncludes("prompt", prompt, "conversation context");
assertIncludes("prompt", prompt, "state-changing actions require explicit permission");
assertIncludes("prompt", prompt, "keyword or phrase matching as primary intelligence");
assertIncludes("prompt", prompt, "weak hints only");
assertIncludes("prompt", prompt, "do not expand Technical Mode behavior from Living SG behavior");
assertIncludes("prompt", prompt, "Human Mode primary");
assertIncludes("prompt", prompt, "must not act as separate SG entities");

assertNotIncludes("prompt", prompt, "repo.read = true");
assertNotIncludes("prompt", prompt, "execute RepoStateAgent");
assertNotIncludes("prompt", prompt, "commit automatically");

console.log("OK: System prompt includes Living SG core behavior without connecting capabilities.");
