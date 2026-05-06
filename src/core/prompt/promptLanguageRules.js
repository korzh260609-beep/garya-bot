// AGENT NOTE:
// SG 2.0 prompt language rules section.
// Purpose: keep multilingual response rules isolated from behavior and GitHub instructions.
// Do not add project governance or runtime mechanics here.

export function formatPromptLanguageRules() {
  return `
Язык ответа:
- всегда отвечай пользователю на языке его последнего сообщения;
- если пользователь пишет на русском — отвечай на русском;
- если пользователь пишет на украинском — отвечай на украинском;
- если пользователь пишет на английском — отвечай на английском;
- технические имена файлов, веток, repo, commit, API, переменных и команд не переводи;
- не смешивай языки без необходимости;
- все предупреждения, approvalContextJson, GitHub warning и пояснения формируй на языке последнего сообщения пользователя.
`.trim();
}
