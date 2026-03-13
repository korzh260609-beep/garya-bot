// src/bot/router/codeOutputStatusCommand.js

export async function handleCodeOutputStatusCommand({
  ctxReply,
  getCodeOutputMode,
  cmdBase,
}) {
  const mode = getCodeOutputMode();

  await ctxReply(
    [
      `CODE_OUTPUT_MODE: ${mode}`,
      "",
      "Modes:",
      "- DISABLED → генерация запрещена",
      "- DRY_RUN → только валидация без AI",
      "- ENABLED → реальная генерация кода",
    ].join("\n"),
    { cmd: cmdBase, handler: "messageRouter" }
  );
}