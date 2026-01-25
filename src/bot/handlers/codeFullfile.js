// ============================================================================
// === src/bot/handlers/codeFullfile.js
// === B7.A: /code_fullfile <path/to/file.js> [requirement...]
// === READ-ONLY: returns FULL FILE, no auto-write
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

function denySensitivePath(path) {
  const lower = String(path || "").toLowerCase();

  // блокируем очевидно чувствительное
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

  // блокируем деплой/воркфлоу-секретные места
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

  // Без callAI — не работаем (чтобы не было “тихих” поломок)
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

  // Тянем файл (как в repoGet), но НЕ печатаем его в чат — только в AI
  const currentFile = await safeFetchText(source, path);
  if (!currentFile) {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  // Контекст правил (если есть — используем; если нет — продолжаем)
  const decisions = await safeFetchText(source, "pillars/DECISIONS.md");
  const workflow = await safeFetchText(source, "pillars/WORKFLOW.md");
  const behavior = await safeFetchText(source, "pillars/SG_BEHAVIOR.md");
  const repoindex = await safeFetchText(source, "pillars/REPOINDEX.md");

  const lang = guessLang(path);

  // Жёсткий контракт вывода: только полный файл, без объяснений
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
    requirement ? `REQUIREMENT: ${requirement}` : "REQUIREMENT: (not provided) — keep behavior, only safe improvements if needed.",
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

  // Финальный guard: не отправляем пустоту
  const finalText = String(out || "").trim();
  if (!finalText) {
    await bot.sendMessage(chatId, "code_fullfile: empty output (refuse).");
    return;
  }

  // Отдаём как полный файл (для копипаста)
  const header = `FULLFILE: ${path}`;
  const codeBlockLang = lang ? lang : "";
  await bot.sendMessage(chatId, `${header}\n\n\`\`\`${codeBlockLang}\n${finalText}\n\`\`\``);
}
