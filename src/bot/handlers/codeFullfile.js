// ============================================================================
// === src/bot/handlers/codeFullfile.js
// === B7.A: /code_fullfile <path/to/file.js> [requirement...]
// === READ-ONLY: returns FULL FILE, no auto-write
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

function denySensitivePath(path) {
  const lower = String(path || "").toLowerCase();

  const bannedParts = [
    ".env",
    "secret",
    "token",
    "apikey",
    "api_key",
    "private",
    "credential",
    "passwd",
    "password",
    "keys",
    "cert",
    "pem",
    "id_rsa",
  ];

  const bannedExact = [
    "render.yaml",
    "dockerfile",
    "docker-compose.yml",
    ".github/workflows",
  ];

  if (bannedExact.some((p) => lower === p || lower.startsWith(p + "/"))) return true;
  if (bannedParts.some((p) => lower.includes(p))) return true;

  return false;
}

function parsePathAndRequirement(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return { path: "", requirement: "" };

  const firstSpace = raw.indexOf(" ");
  if (firstSpace === -1) return { path: raw, requirement: "" };

  const path = raw.slice(0, firstSpace).trim();
  const requirement = raw.slice(firstSpace + 1).trim();
  return { path, requirement };
}

async function safeFetchText(source, path) {
  try {
    const f = await source.fetchTextFile(path);
    if (!f || typeof f.content !== "string") return null;
    return f.content;
  } catch {
    return null;
  }
}

function guessLang(path) {
  const p = String(path || "").toLowerCase();
  if (p.endsWith(".js")) return "javascript";
  if (p.endsWith(".ts")) return "typescript";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".sql")) return "sql";
  return "";
}

// Telegram hard limit is ~4096 chars; keep safe margin.
// We also account for header + code fences overhead.
const TG_MAX_SAFE = 3500;
const TG_MAX_PARTS = 8;

function chunkString(s, size) {
  const str = String(s || "");
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

async function sendInParts(bot, chatId, header, lang, content) {
  const codeBlockLang = lang ? lang : "";

  // If small enough, send once.
  const single = `${header}\n\n\`\`\`${codeBlockLang}\n${content}\n\`\`\``;
  if (single.length <= 4096) {
    await bot.sendMessage(chatId, single);
    return;
  }

  // If too big, split inside code content. Keep each message under TG_MAX_SAFE.
  const fenceOpen = `\`\`\`${codeBlockLang}\n`;
  const fenceClose = `\n\`\`\``;

  // Reserve space for: header + part label + fences
  // Part label example: "FULLFILE: path (Part 1/3)"
  const reserve = header.length + 40 + fenceOpen.length + fenceClose.length + 4;
  const chunkSize = Math.max(800, TG_MAX_SAFE - reserve);

  const parts = chunkString(content, chunkSize);
  if (parts.length > TG_MAX_PARTS) {
    await bot.sendMessage(
      chatId,
      [
        "code_fullfile: OUTPUT TOO LARGE",
        `Reason: too many parts for Telegram (${parts.length} > ${TG_MAX_PARTS}).`,
        "Action: use /code_patch for targeted changes, or ask for smaller file/module split.",
      ].join("\n")
    );
    return;
  }

  for (let i = 0; i < parts.length; i++) {
    const partHeader = `${header} (Part ${i + 1}/${parts.length})`;
    const msg = `${partHeader}\n\n${fenceOpen}${parts[i]}${fenceClose}`;
    await bot.sendMessage(chatId, msg);
  }
}

export async function handleCodeFullfile(ctx) {
  const { bot, chatId, rest, callAI } = ctx || {};

  const { path, requirement } = parsePathAndRequirement(rest);

  if (!path) {
    await bot.sendMessage(chatId, "Usage: /code_fullfile <path/to/file.js> [requirement]");
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, "Access denied: sensitive path.");
    return;
  }

  if (typeof callAI !== "function") {
    await bot.sendMessage(
      chatId,
      "code_fullfile: ERROR\ncallAI not wired. Fix router: pass { callAI } into handleCodeFullfile."
    );
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const currentFile = await safeFetchText(source, path);
  if (!currentFile) {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  const decisions = await safeFetchText(source, "pillars/DECISIONS.md");
  const workflow = await safeFetchText(source, "pillars/WORKFLOW.md");
  const behavior = await safeFetchText(source, "pillars/SG_BEHAVIOR.md");
  const repoindex = await safeFetchText(source, "pillars/REPOINDEX.md");

  const lang = guessLang(path);

  const system = [
    "You are SG (Советник GARYA) operating in READ-ONLY mode.",
    "Task: generate a FULL replacement for a single repository file.",
    "CRITICAL OUTPUT RULES:",
    `- Output MUST be ONLY the full file content for: ${path}`,
    "- Do NOT include explanations, headings, commentary, or markdown fences.",
    "- Do NOT include diff/patch format.",
    "- Preserve intended architecture and boundaries from DECISIONS/WORKFLOW/SG_BEHAVIOR.",
    "- Do NOT invent non-existent modules/paths unless they are already present in current file.",
    "- If you are unsure, choose the safest minimal change that satisfies requirement.",
  ].join("\n");

  const user = [
    `TARGET_FILE: ${path}`,
    requirement
      ? `REQUIREMENT: ${requirement}`
      : "REQUIREMENT: (not provided) — keep behavior, only safe improvements if needed.",
    "",
    "PROJECT_RULES (if provided):",
    decisions ? `DECISIONS.md:\n${decisions}` : "DECISIONS.md: (missing)",
    workflow ? `\nWORKFLOW.md:\n${workflow}` : "\nWORKFLOW.md: (missing)",
    behavior ? `\nSG_BEHAVIOR.md:\n${behavior}` : "\nSG_BEHAVIOR.md: (missing)",
    repoindex ? `\nREPOINDEX.md:\n${repoindex}` : "\nREPOINDEX.md: (missing)",
    "",
    "CURRENT_FILE_CONTENT (for context; do not repeat this label in output):",
    currentFile,
  ].join("\n");

  let out = "";
  try {
    out = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      "high",
      { max_output_tokens: 1800, temperature: 0.2 }
    );
  } catch (e) {
    const msg = e?.message ? String(e.message) : "unknown";
    await bot.sendMessage(chatId, `code_fullfile: AI error: ${msg}`);
    return;
  }

  const finalText = String(out || "").trim();
  if (!finalText) {
    await bot.sendMessage(chatId, "code_fullfile: empty output (refuse).");
    return;
  }

  // If still too large for Telegram, split into parts.
  // (We do not truncate silently.)
  const header = `FULLFILE: ${path}`;

  // quick early warning: very large file content
  if (finalText.length > 20000) {
    await bot.sendMessage(
      chatId,
      [
        "code_fullfile: WARNING",
        `Generated output is very large (${finalText.length} chars).`,
        "Telegram may require splitting; prefer /code_patch for minimal edits.",
      ].join("\n")
    );
  }

  await sendInParts(bot, chatId, header, lang, finalText);
}
