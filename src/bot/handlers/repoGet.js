// ============================================================================
// === src/bot/handlers/repoGet.js — READ-ONLY repo file fetch
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

export async function handleRepoGet({ bot, chatId, rest }) {
  const path = (rest || "").trim();

  if (!path) {
    await bot.sendMessage(chatId, "Usage: /repo_get <path/to/file>");
    return;
  }

  // Safety: deny obvious secrets
  const lower = path.toLowerCase();
  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("key")
  ) {
    await bot.sendMessage(chatId, "Access denied: sensitive file.");
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const file = await source.fetchTextFile(path);

  if (!file || typeof file.content !== "string") {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  // Telegram limit safety
  const MAX_LEN = 3500;
  const content = file.content;

  if (content.length <= MAX_LEN) {
    await bot.sendMessage(
      chatId,
      `📄 ${path}\n\n\`\`\`\n${content}\n\`\`\``
    );
    return;
  }

  // Chunk long files
  let offset = 0;
  let part = 1;
  while (offset < content.length) {
    const chunk = content.slice(offset, offset + MAX_LEN);
    await bot.sendMessage(
      chatId,
      `📄 ${path} (part ${part})\n\n\`\`\`\n${chunk}\n\`\`\``
    );
    offset += MAX_LEN;
    part += 1;
  }
}

