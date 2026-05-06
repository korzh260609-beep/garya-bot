// AGENT NOTE:
// SG 2.0 GitHub approval warning builder.
// Purpose: isolate user-facing write-approval warning text from approval execution logic.
// Do not add approval state, GitHub API calls, behavior policy, or Telegram callback handling here.

export function buildApprovalWarning({ approvalId, summary }) {
  const context = summary.approval_context || {};
  const affectedFiles = context.affected_files?.length ? context.affected_files : [summary.target];
  const affectedLayers = context.affected_layers?.length ? context.affected_layers : ["не указано"];
  const impactLines = context.specific_impact.map((item) => `- ${item}`);
  const notTouchedLines = context.not_touched?.length
    ? context.not_touched.map((item) => `- ${item}`)
    : [];

  return [
    "⚠️ Подтвердить GitHub-действие?",
    "",
    `repo: ${summary.repo}`,
    `branch: ${summary.branch}`,
    `тип: ${context.change_type}`,
    `действие: ${summary.action}`,
    "",
    "Что меняется:",
    context.change_summary,
    "",
    "Зачем:",
    context.reason,
    "",
    "Файлы:",
    ...affectedFiles.map((item) => `- ${item}`),
    "",
    "Затронутые слои:",
    ...affectedLayers.map((item) => `- ${item}`),
    "",
    "Конкретное влияние:",
    ...impactLines,
    ...(notTouchedLines.length ? ["", "Не трогаем:", ...notTouchedLines] : []),
    "",
    "Подтверди или отмени кнопкой ниже.",
    `id: ${approvalId}`,
  ].join("\n");
}
