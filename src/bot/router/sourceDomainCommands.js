// src/bot/router/sourceDomainCommands.js

export async function handleSourceDomainCommands({
  cmdBase,
  handleSourcesList,
  handleSourcesDiag,
  handleSource,
  handleDiagSource,
  handleTestSource,
  bot,
  chatId,
  chatIdStr,
  rest,
  getAllSourcesSafe,
  formatSourcesList,
  runSourceDiagnosticsOnce,
  fetchFromSourceKey,
  diagnoseSource,
  testSource,
}) {
  if (cmdBase === "/sources") {
    await handleSourcesList({
      bot,
      chatId,
      chatIdStr,
      getAllSourcesSafe,
      formatSourcesList,
    });
    return true;
  }

  if (cmdBase === "/sources_diag") {
    await handleSourcesDiag({
      bot,
      chatId,
      chatIdStr,
      rest,
      runSourceDiagnosticsOnce,
    });
    return true;
  }

  if (cmdBase === "/source") {
    await handleSource({
      bot,
      chatId,
      chatIdStr,
      rest,
      fetchFromSourceKey,
    });
    return true;
  }

  if (cmdBase === "/diag_source") {
    await handleDiagSource({
      bot,
      chatId,
      chatIdStr,
      rest,
      diagnoseSource,
    });
    return true;
  }

  if (cmdBase === "/test_source") {
    await handleTestSource({
      bot,
      chatId,
      chatIdStr,
      rest,
      testSource,
    });
    return true;
  }

  return false;
}