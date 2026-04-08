// src/bot/router/repoDomainCommands.js

import { handleRepoReview2 } from "../handlers/repoReview2.js";
import { handleRepoSearch } from "../handlers/repoSearch.js";
import { handleRepoFile } from "../handlers/repoFile.js";
import { handleRepoTree } from "../handlers/repoTree.js";
import { handleRepoStatus } from "../handlers/repoStatus.js";
import { handleRepoReview } from "../handlers/repoReview.js";
import { handleRepoCheck } from "../handlers/repoCheck.js";
import { handleRepoAnalyze } from "../handlers/repoAnalyze.js";
import { handleRepoGet } from "../handlers/repoGet.js";

export async function handleRepoDomainCommands({
  cmdBase,
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
      senderIdStr,
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
      senderIdStr,
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
      senderIdStr,
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