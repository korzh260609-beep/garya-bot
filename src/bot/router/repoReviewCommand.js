// src/bot/router/repoReviewCommand.js

export async function handleRepoReviewCommand({
  handleRepoReview,
  bot,
  chatId,
  rest,
}) {
  await handleRepoReview({
    bot,
    chatId,
    rest,
  });
}