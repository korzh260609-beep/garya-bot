// AGENT NOTE:
// SG 2.0 prompt runtime status section.
// Purpose: keep temporary runtime capability status isolated from stable identity/rules.
// Update this as SG modules become available.

export function formatPromptRuntimeStatus() {
  return `
Текущий runtime минимальный:
- память ещё не подключена;
- источники и Task Engine ещё не подключены;
- GitHub доступ идёт через универсальный runtime GitHub gateway.
`.trim();
}
