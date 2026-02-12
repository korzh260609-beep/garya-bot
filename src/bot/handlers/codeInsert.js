// ============================================================================
// === src/bot/handlers/codeInsert.js
// === B7: /code_insert <path> | <anchor> | <mode> | <requirement>
// === B8: safety limits + dangerous zones
// === B9: unified REFUSE format + refuse logging (no AI)
// === READ-ONLY: returns INSERT block only; user applies manually
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { logCodeOutputRefuse } from "../../codeOutput/codeOutputLogger.js";
import { validateInsert } from "../../codeOutput/codeOutputContract.js";
import { getCodeOutputMode, CODE_OUTPUT_MODES } from "../../codeOutput/codeOutputMode.js";

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

  const bannedExact = [
    "render.yaml",
    "dockerfile",
    "docker-compose.yml",
    ".github/workflows",
  ];

  if (bannedExact.some((p) => lower === p || lower.startsWith(p + "/")))
    return true;
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

  const codeOutputMode = getCodeOutputMode();

  // ==========================================================================
  // STAGE 12A / 4.4 — DRY_RUN (CODE_OUTPUT stays DISABLED)
  // Enabled ONLY when ENV: CODE_OUTPUT_MODE=DRY_RUN
  // Goal: validate request (permissions + private chat + path/anchor/mode/limits + contract format)
  // WITHOUT AI / WITHOUT RepoSource reads / WITHOUT DB writes.
  // Returns ONLY: DRY_RUN_OK or REFUSE.
  // ==========================================================================
  if (codeOutputMode === CODE_OUTPUT_MODES.DRY_RUN) {
    const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "");
    const isMonarch = String(senderIdStr || "") === MONARCH_USER_ID;

    // practical private-chat guard: in PM chatId equals senderId
    const isPrivateLike = String(chatId) === String(senderIdStr || "");

    if (!isMonarch) {
      try {
        console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "DRY_RUN_NOT_MONARCH" });
      } catch (_) {}
      await bot.sendMessage(
        chatId,
        refuseText("NOT_ALLOWED", "Только монарх может использовать CODE OUTPUT (включая DRY_RUN).")
      );
      return;
    }

    if (!isPrivateLike) {
      try {
        console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "DRY_RUN_NOT_PRIVATE_CHAT" });
      } catch (_) {}
      await bot.sendMessage(chatId, refuseText("PRIVATE_ONLY", "Используй команду только в личном чате с SG."));
      return;
    }

    // ---- args ----
    if (!path || !anchor || !mode) {
      await bot.sendMessage(
        chatId,
        refuseText(
          "BAD_ARGS",
          "Формат: /code_insert path | anchor | mode | requirement (mode=before|after|replace)"
        )
      );
      return;
    }

    // ---- path ----
    if (String(path).length > 300) {
      await bot.sendMessage(chatId, refuseText("PATH_TOO_LONG", "Сократи path (≤ 300 символов)."));
      return;
    }
    if (String(path).includes("..") || String(path).startsWith("/") || String(path).startsWith("\\")) {
      await bot.sendMessage(
        chatId,
        refuseText("BAD_PATH", "Запрещены .. и абсолютные пути. Дай относительный путь из репо.")
      );
      return;
    }
    if (denySensitivePath(path)) {
      await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот путь запрещён (секреты/инфраструктура)."));
      return;
    }

    // ---- anchor ----
    if (String(anchor).length > 200) {
      await bot.sendMessage(chatId, refuseText("ANCHOR_TOO_LONG", "Сократи anchor (≤ 200 символов)."));
      return;
    }
    if (isDangerousAnchorOrContent(anchor)) {
      await bot.sendMessage(
        chatId,
        refuseText("DANGEROUS_ANCHOR", "Anchor выглядит опасно (env/secrets/exec/eval). Измени anchor.")
      );
      return;
    }

    // ---- mode ----
    if (!isValidMode(mode)) {
      await bot.sendMessage(chatId, refuseText("MODE_INVALID", "Используй mode: before | after | replace."));
      return;
    }

    // ---- requirement ----
    if (String(requirement || "").length > 1200) {
      await bot.sendMessage(chatId, refuseText("REQ_TOO_LONG", "Сократи requirement (≤ 1200 символов)."));
      return;
    }
    if (isDangerousAnchorOrContent(requirement)) {
      await bot.sendMessage(
        chatId,
        refuseText("DANGEROUS_REQUIREMENT", "Убери упоминания секретов/ключей/exec/eval из requirement.")
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "DRY_RUN_OK",
        "mode: insert",
        `path: ${path}`,
        `anchor: ${anchor}`,
        `insert_mode: ${mode}`,
        "contract: INSERT (<<<INSERT_START>>> … <<<INSERT_END>>>)",
        "ai: not_called | repo: not_read | db: not_written",
      ].join("\n")
    );
    return;
  }
  // ==========================================================================

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
    await bot.sendMessage(
      chatId,
      refuseText("MODE_INVALID", "Используй mode: before | after | replace.")
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "MODE_INVALID",
      });
    } catch (_) {}
    return;
  }

  // ---- B9: SENSITIVE_PATH ----
  if (denySensitivePath(path)) {
    await bot.sendMessage(
      chatId,
      refuseText("SENSITIVE_PATH", "Этот путь запрещён. Выбери обычный файл кода.")
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "SENSITIVE_PATH",
      });
    } catch (_) {}
    return;
  }

  // ---- B9: INTERNAL_ERROR (callAI wiring) ----
  if (typeof callAI !== "function") {
    await bot.sendMessage(
      chatId,
      refuseText(
        "INTERNAL_ERROR",
        "callAI не подключён в router. Проверь передачу { callAI } в handler."
      )
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "INTERNAL_ERROR",
      });
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
    await bot.sendMessage(
      chatId,
      refuseText("FILE_NOT_FOUND", "Файл не найден. Проверь path (как в репозитории).")
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "FILE_NOT_FOUND",
      });
    } catch (_) {}
    return;
  }

  // ---- B9: ANCHOR_NOT FOUND ----
  if (!currentFile.includes(anchor)) {
    await bot.sendMessage(
      chatId,
      refuseText("ANCHOR_NOT_FOUND", "Якорь не найден. Возьми точную строку/фрагмент из файла.")
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "ANCHOR_NOT_FOUND",
      });
    } catch (_) {}
    return;
  }

  // ---- B8: dangerous anchor zones ----
  if (isDangerousAnchorOrContent(anchor)) {
    await bot.sendMessage(
      chatId,
      refuseText(
        "DANGEROUS_ANCHOR",
        "Нельзя вставлять/заменять рядом с env/secrets/exec/eval. Выбери безопасный anchor."
      )
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "DANGEROUS_ANCHOR",
      });
    } catch (_) {}
    return;
  }

  // ---- B8/B9: replace only if anchor unique ----
  if (mode === "replace") {
    const occ = countOccurrences(currentFile, anchor);
    if (occ !== 1) {
      await bot.sendMessage(
        chatId,
        refuseText(
          "ANCHOR_NOT_UNIQUE",
          "Для replace anchor должен встречаться 1 раз. Сделай anchor точнее."
        )
      );
      try {
        console.info("🧾 CODE_REFUSE", {
          ...aiMetaBase,
          refuseReason: "ANCHOR_NOT_UNIQUE",
          occurrences: occ,
        });
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
      console.info("🧾 AI_CALL_END", {
        ...aiMeta,
        dtMs,
        replyChars: 0,
        ok: false,
        error: msg,
      });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("INTERNAL_ERROR", `AI error: ${msg}`));
    return;
  }

  const dtMs = Date.now() - t0;
  try {
    console.info("🧾 AI_CALL_END", {
      ...aiMeta,
      dtMs,
      replyChars: typeof out === "string" ? out.length : 0,
      ok: true,
    });
  } catch (_) {}

  // ---- B9: enforce contract (STAGE 4.3: centralized validator) ----
  const v = validateInsert({
    raw: out,
    expectedPath: path,
    expectedAnchor: anchor,
    maxChars: MAX_INSERT_CHARS,
    forbidMarkersInside: true,
  });

  if (!v.ok || !v.block) {
    await bot.sendMessage(
      chatId,
      refuseText(
        "AI_CONTRACT_VIOLATION",
        `ИИ нарушил формат (${v.code || "UNKNOWN"}). Упрости requirement или выбери другой anchor.`
      )
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "AI_CONTRACT_VIOLATION",
        contractCode: v.code,
      });
    } catch (_) {}
    return;
  }

  const block = v.block;

  // ---- B8: dangerous content check ----
  if (isDangerousAnchorOrContent(block.content)) {
    await bot.sendMessage(
      chatId,
      refuseText(
        "DANGEROUS_ANCHOR",
        "Вставка содержит опасные конструкции (env/exec/eval). Переформулируй задачу безопасно."
      )
    );
    try {
      console.info("🧾 CODE_REFUSE", {
        ...aiMetaBase,
        refuseReason: "DANGEROUS_ANCHOR",
      });
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
