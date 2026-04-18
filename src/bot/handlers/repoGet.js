// ============================================================================
// === src/bot/handlers/repoGet.js — READ-ONLY repo file fetch (Variant A)
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { resolveHandlerAccess, requireMonarchPrivateAccess } from "./handlerAccess.js";

// --- Config (safe defaults) ---
// You can override allowed roots via env: REPO_ALLOWED_ROOTS="src/,core/,pillars/,docs/,README.md,index.js,package.json"
const DEFAULT_ALLOWED_ROOTS = [
  "src/",
  "core/",
  "pillars/",
  "docs/",
  "README.md",
  "index.js",
  "package.json",
];

// Monarch-only extra roots (Contour C: on-demand with guard)
const MONARCH_EXTRA_ROOTS = [
  "migrations/",
  ".github/",
];

function parseAllowedRoots() {
  const raw = String(process.env.REPO_ALLOWED_ROOTS || "").trim();
  if (!raw) return DEFAULT_ALLOWED_ROOTS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRepoPath(input) {
  // Trim + convert backslashes -> slashes
  let p = String(input || "").trim().replace(/\\/g, "/");

  // Remove leading "./"
  while (p.startsWith("./")) p = p.slice(2);

  // Collapse multiple slashes
  p = p.replace(/\/{2,}/g, "/");

  return p;
}

function isPathTraversal(p) {
  // Blocks: ../  /../  ..\ (already normalized)  leading ..  etc.
  if (!p) return true;
  if (p === "..") return true;
  if (p.startsWith("../")) return true;
  if (p.includes("/../")) return true;
  if (p.endsWith("/..")) return true;
  return false;
}

function isAllowedRoot(p, allowedRoots) {
  // Exact matches or prefix matches for folder roots
  for (const root of allowedRoots) {
    if (!root) continue;
    if (root.endsWith("/")) {
      if (p.startsWith(root)) return true;
    } else {
      if (p === root) return true;
    }
  }
  return false;
}

export async function handleRepoGet(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const rawPath = (rest || "").trim();
  if (!rawPath) {
    await bot.sendMessage(chatId, "Usage: /repo_get <path/to/file>");
    return;
  }

  const path = normalizeRepoPath(rawPath);

  // Safety: block traversal / weird paths early
  if (isPathTraversal(path)) {
    await bot.sendMessage(chatId, "Access denied: invalid path.");
    return;
  }

  // Safety: deny obvious secrets (keep original intent)
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

  const allowedRoots = parseAllowedRoots();
  const access = resolveHandlerAccess(ctx);
  const wantsMonarchExtra = isAllowedRoot(path, MONARCH_EXTRA_ROOTS);

  // Extra roots remain monarch-only, but now private-only is already enforced above too.
  if (wantsMonarchExtra && !access.isMonarchUser) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return;
  }

  // Allowlist roots (default) OR monarch-extra roots
  const allowedByDefault = isAllowedRoot(path, allowedRoots);
  const allowedByMonarchExtra = access.isMonarchUser && wantsMonarchExtra;

  if (!allowedByDefault && !allowedByMonarchExtra) {
    const extraHint = access.isMonarchUser ? `, ${MONARCH_EXTRA_ROOTS.join(", ")}` : "";
    await bot.sendMessage(
      chatId,
      `Access denied: path is outside allowed roots.\nAllowed: ${allowedRoots.join(", ")}${extraHint}`
    );
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  // Optional: if RepoSource supports snapshot-based path validation, use it (won't break if absent)
  try {
    if (typeof source.pathInSnapshot === "function") {
      const snapshotOk = await source.pathInSnapshot(path);
      if (!snapshotOk) {
        await bot.sendMessage(chatId, `File blocked (path not in snapshot): ${path}`);
        return;
      }
    }
  } catch {
    // Do not fail the command if optional guard errors
  }

  const file = await source.fetchTextFile(path);

  if (!file || typeof file.content !== "string") {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  // Telegram limit safety
  const MAX_LEN = 3500;
  const content = file.content;

  if (content.length <= MAX_LEN) {
    await bot.sendMessage(chatId, `📄 ${path}\n\n\`\`\`\n${content}\n\`\`\``);
    return;
  }

  // Chunk long files
  let offset = 0;
  let part = 1;
  while (offset < content.length) {
    const chunk = content.slice(offset, offset + MAX_LEN);
    await bot.sendMessage(chatId, `📄 ${path} (part ${part})\n\n\`\`\`\n${chunk}\n\`\`\``);
    offset += MAX_LEN;
    part += 1;
  }
}