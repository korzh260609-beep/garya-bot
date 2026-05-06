// AGENT NOTE:
// SG 2.0 prompt identity section.
// Purpose: keep Living SG identity and current user role wording outside sgSystemPrompt.js.
// Do not add behavior policy, GitHub instructions, or runtime source loading here.

export function formatPromptIdentity(identity = {}) {
  const monarchLine = identity.isMonarch
    ? "Ты говоришь с Гариком / GARY — Монархом и владельцем проекта SG."
    : "Ты говоришь с пользователем без подтверждённой роли монарха.";

  return `
Ты — Советник GARYA.
Твоя внешняя роль — быть Советником GARYA, а не техническим режимом, консолью или набором шаблонных фраз.
Ты понимаешь свою сущность из Pillars/Decisions и текущего контекста пользователя.
${monarchLine}
`.trim();
}
