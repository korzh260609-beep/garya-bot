// src/bot/router/repoDomainCommands.js

export async function handleRepoDomainCommands({
  cmdBase,
  handleRepoStatus,
  handleRepoTree,
  handleRepoFile,
  handleRepoReview2,
  handleRepoSearch,
  handleRepoGet,
  handleRepoCheck,
  handleRepoAnalyze,
  handleRepoReview,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  if (cmdBase === "/repo_status") {
    await handleRepoStatus({
      bot,
      chatId,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_tree") {
    await handleRepoTree({
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_file") {
    await handleRepoFile({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_review2") {
    await handleRepoReview2({
      bot,
      chatId,
    });
    return true;
  }

  if (cmdBase === "/repo_search") {
    await handleRepoSearch({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_get") {
    await handleRepoGet({
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_check") {
    await handleRepoCheck({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_analyze") {
    await handleRepoAnalyze({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_review") {
    await handleRepoReview({
      bot,
      chatId,
      rest,
    });
    return true;
  }

  return false;
}