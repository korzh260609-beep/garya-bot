// ============================================================================
// === src/bot/handlers/codeInsert.js
// === B7: /code_insert <path> | <anchor> | <mode> | <requirement>
// === B8: safety limits + dangerous zones
// === B9: unified REFUSE format + refuse logging (no AI)
// === READ-ONLY: returns INSERT block only; user applies manually
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { logCodeOutputRefuse } from "../../codeOutput/codeOutputLogger.js";

const MAX_INSERT_CHARS = 2000; // ✅ B8 approved

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

  const bannedExact = ["render.yaml", "dockerfile", "docker-compose.yml", ".github/workflows"];

  if (bannedExact.some((p) => lower === p || lower.startsWith(p + "/"))) return true;
  if (bannedParts.some((p) => lower.includes(p))) return true;

  return false;
}

function isDangerousAnchorOrContent(s) {
  const t = String(s || "").toLowerCase();
  const patterns = [
    "process.env",
    "openai_api_key",
    "github_token",
    "monarch_user_id",
    "api_key",
    "apikey",
    "password",
    "passwd",
    "secret",
    "token",
    "eval(",
    "function(",
    "child_process",
    "exec(",
    "spawn(",
    "id_rsa",
    "pem",
  ];
  return patterns.some((p) => t.includes(p));
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

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count++;
    idx = found + needle.length;
  }
  return count;
}

// Hard contract parser: accept ONLY marked block.
function extractInsertBlock(raw) {
  const s = String(raw || "");
  const m = s.match(/<<<INSERT_START>>>\s*([\s\S]*?)\s*<<<INSERT_END>>>/);
  if (!m || !m[1]) return null;

  const body = m[1].trim();

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

  // B8: prevent nested markers
  if (content.includes("<<<") || content.includes(">>>")) return null;

  return { path, anchor, mode, content };
}

export async function handleCodeInsert(ctx) {
  const { bot, chatId, rest, callAI, senderIdStr } = ctx || {};
  const { path, anchor, mode, requirement } = parseInsertArgs(rest);

  const aiMetaBase = {
    handler: "codeInsert",
    event: "CODE_INSERT",
    chatId: String(chatId),
    path,
    mode,
    anchorLen: String(anchor || "").length,
    hasRequirement: Boolean(requirement),
  };

  // ==========================================================================
  // STAGE 12A / 4.2 — HARD BLOCK (CODE OUTPUT DISABLED)
  // Rule: NO code generation, NO RepoSource reads, NO AI calls.
  // Allowed in 4.2: formal refusal + console logging (NO DB).
  // ==========================================================================
  try {
    await logCodeOutputRefuse({
      chatId: String(chatId),
      senderId: String(senderIdStr || ""),
      command: "/code_insert",
      reason: "CODE_OUTPUT_DISABLED_STAGE_4_2",
      path: path || null,
      details: {
        active_stage: "4",
        active_substage: "4.2",
        anchorProvided: Boolean(anchor),
        modeProvided: Boolean(mode),
        hasRequirement: Boolean(requirement),
        note: "Hard-blocked until Stage 4.3+ contract is implemented and CODE OUTPUT is explicitly enabled by monarch decision.",
      },
      snapshotId: null,
      mode: "DISABLED",
    });
  } catch (_) {}

  await bot.sendMessage(
    chatId,
    refuseText(
      "CODE_OUTPUT_DISABLED",
      "CODE OUTPUT отключён (STAGE 4.2). Дождись этапа 4.3+ или используй /repo_file /repo_get для чтения."
    )
  );
  return;
  // ==========================================================================

  // ---- B9: BAD_ARGS ----
  if (!path || !anchor || !mode) {
    await bot.sendMessage(
      chatId,
      [
        refuseText(
          "BAD_ARGS",
          "Формат: /code_insert path | anchor | mode | requirement (mode=before|after|replace)."
        ),
        "Example:",
        "/code_insert src/x.js | export function foo | after | add helper",
      ].join("\n")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "BAD_ARGS" });
    } catch (_) {}
    return;
  }

  // ---- B9: MODE_INVALID ----
  if (!isValidMode(mode)) {
    await bot.sendMessage(chatId, refuseText("MODE_INVALID", "Используй mode: before | after | replace."));
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "MODE_INVALID" });
    } catch (_) {}
    return;
  }

  // ---- B9: SENSITIVE_PATH ----
  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот путь запрещён. Выбери обычный файл кода."));
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "SENSITIVE_PATH" });
    } catch (_) {}
    return;
  }

  // ---- B9: INTERNAL_ERROR (callAI wiring) ----
  if (typeof callAI !== "function") {
    await bot.sendMessage(
      chatId,
      refuseText("INTERNAL_ERROR", "callAI не подключён в router. Проверь передачу { callAI } в handler.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "INTERNAL_ERROR" });
    } catch (_) {}
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const currentFile = await safeFetchText(source, path);

  // ---- B9: FILE NOT FOUND ----
  if (!currentFile) {
    await bot.sendMessage(chatId, refuseText("FILE_NOT_FOUND", "Файл не найден. Проверь path (как в репозитории)."));
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "FILE_NOT_FOUND" });
    } catch (_) {}
    return;
  }

  // ---- B9: ANCHOR_NOT_FOUND ----
  if (!currentFile.includes(anchor)) {
    await bot.sendMessage(
      chatId,
      refuseText("ANCHOR_NOT_FOUND", "Якорь не найден. Возьми точную строку/фрагмент из файла.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "ANCHOR_NOT_FOUND" });
    } catch (_) {}
    return;
  }

  // ---- B8: dangerous anchor zones ----
  if (isDangerousAnchorOrContent(anchor)) {
    await bot.sendMessage(
      chatId,
      refuseText("DANGEROUS_ANCHOR", "Нельзя вставлять/заменять рядом с env/secrets/exec/eval. Выбери безопасный anchor.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "DANGEROUS_ANCHOR" });
    } catch (_) {}
    return;
  }

  // ---- B8/B9: replace only if anchor unique ----
  if (mode === "replace") {
    const occ = countOccurrences(currentFile, anchor);
    if (occ !== 1) {
      await bot.sendMessage(
        chatId,
        refuseText("ANCHOR_NOT_UNIQUE", "Для replace anchor должен встречаться 1 раз. Сделай anchor точнее.")
      );
      try {
        console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "ANCHOR_NOT_UNIQUE", occurrences: occ });
      } catch (_) {}
      return;
    }
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
    "4) content MUST be <= 2000 characters.",
    "5) Do NOT touch secrets/env/keys. Do NOT call exec/eval/spawn/child_process.",
    "6) If unsure, generate the minimal safe insertion that satisfies requirement.",
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

  // ---- AI CALL (with existing observability pattern) ----
  const aiReason = "code_insert.apply_patch_suggestion";
  const aiMeta = {
    ...aiMetaBase,
    reason: aiReason,
    aiCostLevel: "high",
    max_output_tokens: 1400,
    temperature: 0.2,
  };

  try {
    console.info("🧾 AI_CALL_START", aiMeta);
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
      { max_output_tokens: 1400, temperature: 0.2 }
    );
  } catch (e) {
    const msg = e?.message ? String(e.message) : "unknown";
    const dtMs = Date.now() - t0;

    try {
      console.info("🧾 AI_CALL_END", { ...aiMeta, dtMs, replyChars: 0, ok: false, error: msg });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("INTERNAL_ERROR", `AI error: ${msg}`));
    return;
  }

  const dtMs = Date.now() - t0;
  try {
    console.info("🧾 AI_CALL_END", { ...aiMeta, dtMs, replyChars: typeof out === "string" ? out.length : 0, ok: true });
  } catch (_) {}

  // ---- B9: enforce contract ----
  const block = extractInsertBlock(out);
  if (!block) {
    await bot.sendMessage(
      chatId,
      refuseText("AI_CONTRACT_VIOLATION", "ИИ нарушил формат. Упрости requirement или выбери другой anchor.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "AI_CONTRACT_VIOLATION" });
    } catch (_) {}
    return;
  }

  // Safety: returned path must match requested path
  if (String(block.path).trim() !== String(path).trim()) {
    await bot.sendMessage(
      chatId,
      refuseText("AI_CONTRACT_VIOLATION", "ИИ вернул другой path. Повтори запрос, не меняя path.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "AI_CONTRACT_VIOLATION", returnedPath: block.path });
    } catch (_) {}
    return;
  }

  // Safety: anchor must match requested anchor (1:1)
  if (String(block.anchor).trim() !== String(anchor).trim()) {
    await bot.sendMessage(
      chatId,
      refuseText("AI_CONTRACT_VIOLATION", "ИИ изменил anchor. Повтори запрос с тем же anchor.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "AI_CONTRACT_VIOLATION", returnedAnchor: block.anchor });
    } catch (_) {}
    return;
  }

  // ---- B8: enforce insert size ----
  if (String(block.content).length > MAX_INSERT_CHARS) {
    await bot.sendMessage(
      chatId,
      refuseText("INSERT_TOO_LARGE", `Вставка слишком большая (> ${MAX_INSERT_CHARS}). Разбей на 2–3 вставки.`)
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "INSERT_TOO_LARGE", insertChars: block.content.length });
    } catch (_) {}
    return;
  }

  // ---- B8: dangerous content check ----
  if (isDangerousAnchorOrContent(block.content)) {
    await bot.sendMessage(
      chatId,
      refuseText("DANGEROUS_ANCHOR", "Вставка содержит опасные конструкции (env/exec/eval). Переформулируй задачу безопасно.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "DANGEROUS_ANCHOR" });
    } catch (_) {}
    return;
  }

  // Return the exact block + tiny preview (safe, non-AI)
  const reply = [
    "<<<INSERT_START>>>",
    `path: ${block.path}`,
    `anchor: ${block.anchor}`,
    `mode: ${block.mode}`,
    "content:",
    block.content,
    "<<<INSERT_END>>>",
    "",
    `Preview: mode=${block.mode}, insertChars=${block.content.length} (max=${MAX_INSERT_CHARS}).`,
    "Reminder: ты вставляешь вручную в репозиторий.",
  ].join("\n");

  await bot.sendMessage(chatId, reply);
}
