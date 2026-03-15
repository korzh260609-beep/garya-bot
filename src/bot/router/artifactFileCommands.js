// src/bot/router/artifactFileCommands.js
//
// ⚠️ LEGACY / FALLBACK MARKER
//
// ВАЖНО:
// - этот файл больше НЕ является authoritative path для /ar_list и /file_logs
// - текущий authoritative path для этих команд сейчас:
//   cmdActionMap.js -> CMD_ACTION
//   messageRouter.js -> dispatchCommand(...)
//   commandDispatcher.js -> handlers
//
// Причина сохранения файла:
// - безопасный marker-stub без изменения active router wiring
// - чтобы не ломать текущий import/use-site в messageRouter.js
// - чтобы явно убрать ложное впечатление, что /ar_list и /file_logs живут здесь
//
// ПРАВИЛА:
// - не добавлять сюда новую командную логику
// - не считать этот файл рабочим command path
// - если позже будет отдельный cleanup-step:
//   1) убрать import из messageRouter.js
//   2) убрать вызов handleArtifactFileCommands(...)
//   3) удалить файл отдельным commit
//
// Текущее поведение:
// - всегда возвращает false
// - runtime-routing не меняет
// - active dispatcher path остаётся прежним

export async function handleArtifactFileCommands() {
  return false;
}