// ============================================================================
// === src/bot/handlers/codeInsert.js
// === B7: /code_insert <path> | <anchor> | <mode> | <requirement>
// === READ-ONLY: returns INSERT block only; user applies manually
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

  const bannedExact = ["render.yaml", "dockerfile", "docker-compose.yml", ".github/workflows"];

  if (bannedExact.some((p) => lower === p || lower.startsWith(p + "/"))) return true;
  if (bannedParts.some((p) => lower.includes(p))) return true;

  return false;
}

function parseInsertArgs(rest) {
  // Expected format:
  // /code_insert path | anchor | mode | requirement
  const raw = String(rest || "").trim();
  if (!raw) return { path: "", anchor: "", mode: "", requirement: "" };

  const parts = raw.split("|").map((s) => s.trim());
  const path = parts[0] || "";
  const anchor = parts[1] || "";
  const mode = (parts[2] || "").toLowerCase();
  const requirement = parts.slice(3).join(" | ").trim(); // keep remaining pipes inside requirement

  return { path, anchor, mode, requirement };
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

function isValidMode(mode) {
  return mode === "before" || mode === "after" || mode === "replace";
}

// Hard contract parser: accept ONLY marked block.
function extractInsertBlock(raw) {
  const s = String(raw || "");
  const m = s.match(/<<<INSERT_START>>>\s*([\s\S]*?)\s*<<<INSERT_END>>>/);
  if (!m || !m[1]) return null;

  const body = m[1].trim();

  // Minimal, strict-ish parsing
  const pathMatch = body.match(/(?:^|\n)path:\s*(.+)\s*(?:\n|$)/i);
  const anchorMatch = body.match(/(?:^|\n)anchor:\s*(.+)\s*(?:\n|$)/i);
  const modeMatch = body.match(/(?:^|\n)mode:\s*(before|after|replace)\s*(?:\n|$)/i);
  const contentMatch = body.match(/(?:^|\n)content:\s*\n([\s\S]*)$/i);

  const path = pathMatch ? String(pathMatch[1]).trim() : "";
  const anchor = anchorMatch ? String(anchorMatch[1]).trim() : "";
  const mode = modeMatch ? String(modeMatch[1]).trim().toLowerCase() : "";
  const content = contentMatch ? String(contentMatch[1]).replace(/\s+$/, "") : "";

  if (!path || !anchor || !mode || !content) return null;
  if (!isValidMode(mode)) return null;

  return { path, anchor, mode, content };
}

export async function handleCodeInsert(ctx) {
  const { bot, chatId, rest, callAI } = ctx || {};
  const { path, anchor, mode, requirement } = parseInsertArgs(rest);

  if (!path || !anchor || !mode) {
    await bot.sendMessage(
      chatId,
      [
        "Usage:",
        "/code_insert <path> | <anchor> | <mode> | <requirement>",
        "mode = before|after|replace",
        "Example:",
        "/code_insert src/x.js | export function foo | after | add a new helper function",
      ].join("\n")
    );
    return;
  }

  if (!isValidMode(mode)) {
    await bot.sendMessage(chatId, "code_insert: invalid mode. Use before|after|replace.");
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, "Access denied: sensitive path.");
    return;
  }

  if (typeof callAI !== "function") {
    await bot.sendMessage(
      chatId,
      "code_insert: ERROR\ncallAI not wired. Fix router: pass { callAI } into handleCodeInsert."
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

  // Anchor must exist in file (hard guard)
  if (!currentFile.includes(anchor)) {
    await bot.sendMessage(
      chatId,
      [
        "code_insert: anchor not found in file.",
        `path: ${path}`,
        `anchor: ${anchor}`,
        "Tip: use an exact line/fragment that exists in the file.",
      ].join("\n")
    );
    return;
  }

  const decisions = await safeFetchText(source, "pillars/DECISIONS.md");
  const workflow = await safeFetchText(source, "pillars/WORKFLOW.md");
  const behavior = await safeFetchText(source, "pillars/SG_BEHAVIOR.md");

  const system = [
    "You are SG (Советник GARYA) operating in READ-ONLY mode.",
    "Task: produce a single INSERT block for a repository file change.",
    "",
    "ABSOLUTE OUTPUT CONTRACT:",
    "1) Output ONLY one block between markers exactly:",
    "<<<INSERT_START>>>",
    "path: <path>",
    "anchor: <anchor>",
    "mode: before|after|replace",
    "content:",
    "<ONLY THE INSERT CONTENT>",
    "<<<INSERT_END>>>",
    "2) NO explanations. NO markdown fences. NO extra text outside the block.",
    "3) content must be the exact insertion text the user will paste.",
    "4) content must preserve project architecture and boundaries.",
    "5) If unsure, generate the minimal safe insertion that satisfies requirement.",
  ].join("\n");

  const user = [
    `TARGET_FILE: ${path}`,
    `ANCHOR: ${anchor}`,
    `MODE: ${mode}`,
    `REQUIREMENT: ${requirement || "(not provided) — minimal safe insertion only."}`,
    "",
    decisions ? `DECISIONS.md:\n${decisions}` : "DECISIONS.md: (missing)",
    workflow ? `\nWORKFLOW.md:\n${workflow}` : "\nWORKFLOW.md: (missing)",
    behavior ? `\nSG_BEHAVIOR.md:\n${behavior}` : "\nSG_BEHAVIOR.md: (missing)",
    "",
    "CURRENT_FILE_CONTENT (for context; do not repeat this label in output):",
    currentFile,
  ].join("\n");

  // ---- OBSERVABILITY (minimal) ----
  const aiReason = "code_insert.apply_patch_suggestion";
  const aiMetaBase = {
    handler: "codeInsert",
    reason: aiReason,
    aiCostLevel: "high",
    max_output_tokens: 1400,
    temperature: 0.2,
    chatId: String(chatId),
    path,
    mode,
    anchorLen: String(anchor).length,
    hasRequirement: Boolean(requirement),
  };

  try {
    console.info("🧾 AI_CALL_START", aiMetaBase);
  } catch (_) {}

  const t0 = Date.now();
  // -------------------------------

  let out = "";
  try {
    out = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      "high",
      { max_output_tokens: 1400, temperature: 0.2 }
    );
  } catch (e) {
    const msg = e?.message ? String(e.message) : "unknown";
    const dtMs = Date.now() - t0;

    try {
      console.info("🧾 AI_CALL_END", {
        ...aiMetaBase,
        dtMs,
        replyChars: 0,
        ok: false,
        error: msg,
      });
    } catch (_) {}

    await bot.sendMessage(chatId, `code_insert: AI error: ${msg}`);
    return;
  }

  const dtMs = Date.now() - t0;
  try {
    console.info("🧾 AI_CALL_END", {
      ...aiMetaBase,
      dtMs,
      replyChars: typeof out === "string" ? out.length : 0,
      ok: true,
    });
  } catch (_) {}
  // -------------------------------

  const block = extractInsertBlock(out);
  if (!block) {
    await bot.sendMessage(
      chatId,
      [
        "code_insert: invalid output (refuse).",
        "Reason: model did not follow the INSERT contract.",
        "Action: retry with a simpler requirement, or provide a more specific anchor.",
      ].join("\n")
    );
    return;
  }

  // Safety: ensure returned path matches requested path
  if (String(block.path).trim() !== String(path).trim()) {
    await bot.sendMessage(
      chatId,
      [
        "code_insert: invalid output (refuse).",
        "Reason: returned path does not match requested path.",
        `requested: ${path}`,
        `returned: ${block.path}`,
      ].join("\n")
    );
    return;
  }

  // Return the exact block (no fences)
  const reply = [
    "<<<INSERT_START>>>",
    `path: ${block.path}`,
    `anchor: ${block.anchor}`,
    `mode: ${block.mode}`,
    "content:",
    block.content,
    "<<<INSERT_END>>>",
  ].join("\n");

  await bot.sendMessage(chatId, reply);
}

