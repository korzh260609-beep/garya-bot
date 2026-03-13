// src/bot/router/projectMemoryCommands.js

export async function handleProjectMemoryCommands({
  cmdBase,
  handlePmShow,
  handlePmSet,
  bot,
  chatId,
  chatIdStr,
  rest,
  getProjectSection,
  upsertProjectSection,
}) {
  if (cmdBase === "/pm_show") {
    await handlePmShow({
      bot,
      chatId,
      rest,
      getProjectSection,
    });
    return true;
  }

  if (cmdBase === "/pm_set") {
    await handlePmSet({
      bot,
      chatId,
      chatIdStr,
      rest,
      upsertProjectSection,
      bypass: true,
    });
    return true;
  }

  return false;
}