// ============================================================================
// === src/bot/handlers/repoDiff.js — READ-ONLY repo diff (SKELETON V1)
// === Command: /repo_diff <pathA> <pathB>
// === Purpose: compare two files from GitHub repo (no writes, no patches yet)
// ============================================================================

// READ-ONLY CONTRACT
// repo_diff is a comparison-only tool.
// - No writes
// - No execution
// - No auto-apply
// Output: unified diff preview only

import { RepoSource } from "../../repo/RepoSource.js";

function denySensitivePath(path) {
  const lower = String(path || "").toLowerCase();
  return (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("key")
  );
}

function normalizePath(p) {
  return String(p || "").trim().replace(/^\/+/, "");
}

/**
 * Minimal line-by-line diff (NOT a full unified diff algorithm).
 * Good enough for SKELETON: show where lines differ, capped to avoid Telegram limits.
 */
function makeSimpleDiff(aText, bText, opts = {}) {
  const maxHunks = opts.maxHunks ?? 60; // cap output
  const context = opts.context ?? 0;

  const aLines = String(aText || "").split("\n");
  const bLines = String(bText || "").split("\n");

  const max = Math.max(aLines.length, bLines.length);
  const out = [];
  let hunks = 0;

  for (let i = 0; i < max; i++) {
    const a = aLines[i];
    const b = bLines[i];

    if (a === b) continue;

    hunks++;
    if (hunks > maxHunks) {
      out.push(`...diff truncated (>${maxHunks} hunks)`);
      break;
    }

    const lineNo = i + 1;

    // Optional context (kept 0 by default to reduce noise)
    if (context > 0) {
      const start = Math.max(0, i - context);
      const end = Math.min(max - 1, i + context);
      out.push(`@@ around line ${lineNo} @@`);
      for (let j = start; j <= end; j++) {
        const aa = aLines[j];
        const bb = bLines[j];
        if (aa === bb) out.push(` ${aa ?? ""}`);
        else {
          out.push(`-${aa ?? ""}`);
          out.push(`+${bb ?? ""}`);
        }
      }
    } else {
      out.push(`@@ line ${lineNo} @@`);
      out.push(`-${a ?? ""}`);
      out.push(`+${b ?? ""}`);
    }
  }

  return out;
}

export async function handleRepoDiff({ bot, chatId, rest }) {
  const raw = String(rest || "").trim();
  if (!raw) {
    await bot.sendMessage(chatId, "Usage: /repo_diff <pathA> <pathB>");
    return;
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    await bot.sendMessage(chatId, "Usage: /repo_diff <pathA> <pathB>");
    return;
  }

  const pathA = normalizePath(parts[0]);
  const pathB = normalizePath(parts[1]);

  if (denySensitivePath(pathA) || denySensitivePath(pathB)) {
    await bot.sendMessage(chatId, "Access denied: sensitive file.");
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const fileA = await source.fetchTextFile(pathA);
  const fileB = await source.fetchTextFile(pathB);

  if (!fileA || typeof fileA.content !== "string") {
    await bot.sendMessage(chatId, `File A not found or cannot be read: ${pathA}`);
    return;
  }
  if (!fileB || typeof fileB.content !== "string") {
    await bot.sendMessage(chatId, `File B not found or cannot be read: ${pathB}`);
    return;
  }

  if (fileA.content === fileB.content) {
    await bot.sendMessage(chatId, `repo_diff: OK (files identical)\nA: ${pathA}\nB: ${pathB}`);
    return;
  }

  const diffLines = makeSimpleDiff(fileA.content, fileB.content, {
    maxHunks: 60,
    context: 0,
  });

  // Telegram message safety cap
  const header = `repo_diff:\nA: ${pathA}\nB: ${pathB}\n`;
  let body = diffLines.join("\n");
  const MAX = 3500; // conservative for Telegram

  if (body.length > MAX) body = body.slice(0, MAX) + "\n...output truncated";

  await bot.sendMessage(chatId, `${header}\n\`\`\`\n${body}\n\`\`\``);
}

