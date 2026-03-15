// src/bot/router/repoDomainCommands.js

export async function handleRepoDomainCommands({
  cmdBase,
  handleRepoStatusCommand,
  handleRepoTreeCommand,
  handleRepoFileCommand,
  handleRepoReview2Command,
  handleRepoSearchCommand,
  handleRepoGetCommand,
  handleRepoCheckCommand,
  handleRepoAnalyzeCommand,
  handleRepoReviewCommand,
  bot,
  chatId,
  rest,
  senderIdStr,
}) {
  if (cmdBase === "/repo_status") {
    await handleRepoStatusCommand({
      handleRepoStatus,
      bot,
      chatId,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_tree") {
    await handleRepoTreeCommand({
      handleRepoTree,
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_file") {
    await handleRepoFileCommand({
      handleRepoFile,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_review2") {
    await handleRepoReview2Command({
      handleRepoReview2,
      bot,
      chatId,
    });
    return true;
  }

  if (cmdBase === "/repo_search") {
    await handleRepoSearchCommand({
      handleRepoSearch,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_get") {
    await handleRepoGetCommand({
      handleRepoGet,
      bot,
      chatId,
      rest,
      senderIdStr,
    });
    return true;
  }

  if (cmdBase === "/repo_check") {
    await handleRepoCheckCommand({
      handleRepoCheck,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_analyze") {
    await handleRepoAnalyzeCommand({
      handleRepoAnalyze,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  if (cmdBase === "/repo_review") {
    await handleRepoReviewCommand({
      handleRepoReview,
      bot,
      chatId,
      rest,
    });
    return true;
  }

  return false;
}