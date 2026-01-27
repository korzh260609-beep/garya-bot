// ============================================================================
// === src/bot/handlers/codeFullfile.js
// === /code_fullfile <path/to/file.js> [requirement...]
// === B8: fullfile size limit
// === B9: unified REFUSE format
// === READ-ONLY: returns FULL FILE, no auto-write
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

const MAX_FULLFILE_CHARS = 60000; // ✅ B8 approved

function refuseText(reason, action) {
  return `REFUSE\n- Причина: ${reason}\n- Что сделать: ${action}`;
}

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

  const single = `${header}\n\n\`\`\`${codeBlockLang}\n${content}\n\`\`\``;
  if (single.length <= 4096) {
    await bot.sendMessage(chatId, single);
    return;
  }

  const fenceOpen = `\`\`\`${codeBlockLang}\n`;
  const fenceClose = `\n\`\`\``;

  const reserve = header.length + 40 + fenceOpen.length + fenceClose.length + 4;
  const chunkSize = Math.max(800, TG_MAX_SAFE - reserve);

  const parts = chunkString(content, chunkSize);
  if (parts.length > TG_MAX_PARTS) {
    await bot.sendMessage(
      chatId,
      [
        refuseText(
          "FULLFILE_TOO_LARGE",
          `Слишком много частей для Telegram (${parts.length} > ${TG_MAX_PARTS}). Используй /code_insert или уменьши запрос.`
        ),
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

function extractOnlyFileText(raw) {
  const s = String(raw || "");

  const m = s.match(/<<<FILE_START>>>\s*([\s\S]*?)\s*<<<FILE_END>>>/);
  if (m && m[1]) return m[1].trim();

  const fence = s.match(/```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```/);
  if (fence && fence[1]) return fence[1].trim();

  const idx = s.search(
    /\b(export\s+async\s+function|export\s+function|module\.exports|import\s+|const\s+|function\s+|class\s+)\b/
  );
  if (idx >= 0) return s.slice(idx).trim();

  return s.trim();
}

export async function handleCodeFullfile(ctx) {
  const { bot, chatId, rest, callAI } = ctx || {};
  const { path, requirement } = parsePathAndRequirement(rest);

  const baseMeta = {
    handler: "codeFullfile",
    chatId: String(chatId),
    path,
    hasRequirement: Boolean(requirement),
  };

  if (!path) {
    await bot.sendMessage(chatId, refuseText("BAD_ARGS", "Usage: /code_fullfile <path/to/file.js> [requirement]"));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "BAD_ARGS" });
    } catch (_) {}
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот путь запрещён. Выбери обычный файл кода."));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "SENSITIVE_PATH" });
    } catch (_) {}
    return;
  }

  if (typeof callAI !== "function") {
    await bot.sendMessage(
      chatId,
      refuseText("INTERNAL_ERROR", "callAI не подключён в router. Проверь передачу { callAI } в handler.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "INTERNAL_ERROR" });
    } catch (_) {}
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const currentFile = await safeFetchText(source, path);
  if (!currentFile) {
    await bot.sendMessage(chatId, refuseText("FILE_NOT_FOUND", `Файл не найден или не читается: ${path}`));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "FILE_NOT_FOUND" });
    } catch (_) {}
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
    "",
    "ABSOLUTE OUTPUT CONTRACT:",
    `1) You MUST output ONLY the full file content for: ${path}`,
    "2) NO explanations, NO notes, NO headings, NO preface text.",
    "3) Wrap the file content ONLY between markers exactly like this:",
    "<<<FILE_START>>>",
    "<FULL FILE CONTENT HERE>",
    "<<<FILE_END>>>",
    "4) Do NOT include markdown fences. Do NOT include any other text outside markers.",
    "5) Do NOT output diff/patch format.",
    "6) Preserve intended architecture and boundaries from DECISIONS/WORKFLOW/SG_BEHAVIOR.",
    "7) Do NOT invent non-existent modules/paths unless they are already present in current file.",
    "8) If unsure, choose the safest minimal change that satisfies requirement.",
    `9) Output must be <= ${MAX_FULLFILE_CHARS} characters.`,
    "If you violate the contract, the output will be discarded as invalid.",
  ].join("\n");

  const user = [
    `TARGET_FILE: ${path}`,
    requirement ? `REQUIREMENT: ${requirement}` : "REQUIREMENT: (not provided) — keep behavior, only minimal safe changes if needed.",
    "",
    "PROJECT_RULES (if provided):",
    decisions ? `DECISIONS.md:\n${decisions}` : "DECISIONS.md: (missing)",
    workflow ? `\nWORKFLOW.md:\n${workflow}` : "\nWORKFLOW.md: (missing)",
    behavior ? `\nSG_BEHAVIOR.md:\n${behavior}` : "\nSG_BEHAVIOR.md: (missing)",
    repoindex ? `\nREPOINDEX.md:\n${repoindex}` : "\nREPOINDEX.md: (missing)",
    "",
    "CURRENT_FILE_CONTENT (for context; do not repeat this label in output):",
    currentFile,
    "",
    "REMINDER: output ONLY file content between <<<FILE_START>>> and <<<FILE_END>>>.",
  ].join("\n");

  const aiMetaBase = {
    ...baseMeta,
    reason: "code_fullfile.generate_fullfile",
    aiCostLevel: "high",
    max_output_tokens: 1800,
    temperature: 0.2,
  };

  try {
    console.info("🧾 AI_CALL_START", aiMetaBase);
  } catch (_) {}

  const t0 = Date.now();

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
    const dtMs = Date.now() - t0;

    try {
      console.info("🧾 AI_CALL_END", { ...aiMetaBase, dtMs, replyChars: 0, ok: false, error: msg });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("INTERNAL_ERROR", `AI error: ${msg}`));
    return;
  }

  const dtMs = Date.now() - t0;
  try {
    console.info("🧾 AI_CALL_END", { ...aiMetaBase, dtMs, replyChars: typeof out === "string" ? out.length : 0, ok: true });
  } catch (_) {}

  const finalText = extractOnlyFileText(out);

  if (!finalText) {
    await bot.sendMessage(chatId, refuseText("AI_CONTRACT_VIOLATION", "Пустой/невалидный вывод. Упрости requirement и повтори."));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "AI_CONTRACT_VIOLATION", detail: "empty" });
    } catch (_) {}
    return;
  }

  // ---- B8: enforce fullfile size cap ----
  if (finalText.length > MAX_FULLFILE_CHARS) {
    await bot.sendMessage(
      chatId,
      refuseText("FULLFILE_TOO_LARGE", `Слишком большой файл (> ${MAX_FULLFILE_CHARS}). Используй /code_insert или уменьшай изменения.`)
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "FULLFILE_TOO_LARGE", fullfileChars: finalText.length });
    } catch (_) {}
    return;
  }

  const header = `FULLFILE: ${path}`;
  await sendInParts(bot, chatId, header, lang, finalText);
}
