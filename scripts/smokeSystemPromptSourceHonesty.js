// scripts/smokeSystemPromptSourceHonesty.js
// ============================================================================
// SYSTEM PROMPT SOURCE HONESTY SMOKE CHECK
//
// Purpose:
// - verify the final system prompt contains source/tool honesty rules;
// - verify SG must not invent unavailable source access;
// - verify SG must not simulate private capabilities;
// - verify prompt does not connect repo/tool/runtime capabilities;
// - does not call AI;
// - does not read/write repo/runtime state.
// ============================================================================

import { buildSystemPrompt } from "../systemPrompt.js";

function assertIncludes(name, value, expectedPart) {
  const text = String(value || "");
  if (!text.includes(expectedPart)) {
    throw new Error(`System prompt source honesty smoke check failed: ${name}: missing ${expectedPart}`);
  }
}

function assertNotIncludes(name, value, forbiddenPart) {
  const text = String(value || "");
  if (text.includes(forbiddenPart)) {
    throw new Error(`System prompt source honesty smoke check failed: ${name}: forbidden ${forbiddenPart}`);
  }
}

const prompt = buildSystemPrompt(
  "normal",
  "Режим normal: test.",
  "",
  {
    isMonarch: true,
    currentUserName: "GARY",
    userText: "можешь проверить репозиторий и сказать что там сейчас?",
  }
);

assertIncludes("prompt", prompt, "ИСТОЧНИКИ:");
assertIncludes("prompt", prompt, "Источник считай доступным только если он реально подключён и реально дал результат в текущем runtime.");
assertIncludes("prompt", prompt, "Если источник не вызывался, не выдавай данные за проверенные.");
assertIncludes("prompt", prompt, "Source-first: сначала реальный источник, потом анализ.");
assertIncludes("prompt", prompt, "do not invent source access");
assertIncludes("prompt", prompt, "if a source/tool was not actually executed and returned data, say so");
assertIncludes("prompt", prompt, "do not connect or simulate private capabilities");
assertIncludes("prompt", prompt, "state-changing actions require explicit permission");
assertIncludes("prompt", prompt, "raw semantic input only");

assertNotIncludes("prompt", prompt, "repo.read = true");
assertNotIncludes("prompt", prompt, "execute RepoStateAgent");
assertNotIncludes("prompt", prompt, "commit automatically");
assertNotIncludes("prompt", prompt, "simulate source access");
assertNotIncludes("prompt", prompt, "source/tool access is always available");
assertNotIncludes("prompt", prompt, "private capabilities are connected");
assertNotIncludes("prompt", prompt, "bypass confirmation");

console.log("OK: System prompt preserves source/tool honesty and does not simulate unavailable capabilities.");
