// ============================================================================
// === src/bot/handlers/codeFullfile.js
// === /code_fullfile <path/to/file.js> [requirement...]
// === B8: fullfile size limit
// === B9: unified REFUSE format
// === READ-ONLY: returns FULL FILE, no auto-write
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { logCodeOutputRefuse } from "../../codeOutput/codeOutputLogger.js";
import { validateFullFile } from "../../codeOutput/codeOutputContract.js";
import { getCodeOutputMode, CODE_OUTPUT_MODES } from "../../codeOutput/codeOutputMode.js";

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

  const bannedExact = ["render.yaml", "dockerfile", "docker-compose.yml", ".github/workflows"];

  if (bannedExact.some((p) => lower === p || lower.startsWith(p + "/"))) return true;
  if (bannedParts.some((p) => lower.includes(p))) return true;

  return false;
}

function parsePathAndRequirement(rest) {
  const s = String(rest || "");
  const idx = s.indexOf(" ");

  if (idx >= 0) return { path: s.slice(0, idx).trim(), requirement: s.slice(idx).trim() };

  return { path: s.trim(), requirement: "" };
}

export async function handleCodeFullfile(ctx) {
  const { bot, chatId, rest, callAI, senderIdStr } = ctx || {};
  const { path, requirement } = parsePathAndRequirement(rest);

  const baseMeta = {
    handler: "codeFullfile",
    chatId: String(chatId),
    path,
    hasRequirement: Boolean(requirement),
  };

  const mode = getCodeOutputMode();

  // ==========================================================================
  // STAGE 12A / 4.4 — DRY_RUN (CODE_OUTPUT stays DISABLED)
  // Enabled ONLY when ENV: CODE_OUTPUT_MODE=DRY_RUN
  // Goal: validate request (permissions + private chat + path/limits + contract) WITHOUT AI/Repo/DB.
  // Returns ONLY: DRY_RUN_OK or REFUSE.
  // ==========================================================================
  if (mode === CODE_OUTPUT_MODES.DRY_RUN) {
    const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "");
    const isMonarch = String(senderIdStr || "") === MONARCH_USER_ID;

    // practical private-chat guard: in PM chatId equals senderId
    const isPrivateLike = String(chatId) === String(senderIdStr || "");

    if (!isMonarch) {
      try {
        console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "DRY_RUN_NOT_MONARCH" });
      } catch (_) {}
      await bot.sendMessage(
        chatId,
        refuseText("NOT_ALLOWED", "Только монарх может использовать CODE OUTPUT (включая DRY_RUN).")
      );
      return;
    }

    if (!isPrivateLike) {
      try {
        console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "DRY_RUN_NOT_PRIVATE_CHAT" });
      } catch (_) {}
      await bot.sendMessage(chatId, refuseText("PRIVATE_ONLY", "Используй команду только в личном чате с SG."));
      return;
    }

    if (!path) {
      await bot.sendMessage(chatId, refuseText("BAD_ARGS", "Формат: /code_fullfile <path/to/file.js> [requirement...]"));
      return;
    }

    if (String(path).length > 300) {
      await bot.sendMessage(chatId, refuseText("PATH_TOO_LONG", "Сократи path (≤ 300 символов)."));
      return;
    }

    if (denySensitivePath(path)) {
      await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот path запрещён (секреты/инфраструктура)."));
      return;
    }

    const dangerousReq = (s) => {
      const t = String(s || "").toLowerCase();
      const patterns = [
        "process.env",
        "openai_api_key",
        "github_token",
        "api_key",
        "apikey",
        "password",
        "passwd",
        "secret",
        "token",
        "id_rsa",
        "pem",
      ];
      return patterns.some((p) => t.includes(p));
    };

    if (dangerousReq(requirement)) {
      await bot.sendMessage(chatId, refuseText("DANGEROUS_REQUIREMENT", "Убери упоминания секретов/ключей из requirement."));
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "DRY_RUN_OK",
        "mode: fullfile",
        `path: ${path}`,
        "contract: FULLFILE (<<<FILE_START>>> … <<<FILE_END>>>)",
        "ai: not_called | repo: not_read | db: not_written",
      ].join("\n")
    );
    return;
  }
  // ==========================================================================

  // ==========================================================================
  // STAGE 12A / 4.2 — HARD BLOCK (CODE OUTPUT DISABLED)
  // Rule: NO code generation, NO RepoSource reads, NO AI calls.
  // ==========================================================================
  try {
    await logCodeOutputRefuse({
      chatId: String(chatId),
      senderId: String(senderIdStr || ""),
      command: "/code_fullfile",
      reason: "CODE_OUTPUT_DISABLED_STAGE_4_2",
      path: path || null,
      details: {
        active_stage: "4",
        active_substage: "4.2",
        hasRequirement: Boolean(requirement),
        note: "Hard-blocked until Stage 4.3+ contract is implemented and CODE OUTPUT is explicitly enabled by monarch decision.",
      },
      snapshotId: null,
      mode: "DISABLED",
    });
  } catch (_) {
    // never
  }

  await bot.sendMessage(
    chatId,
    refuseText(
      "CODE_OUTPUT_DISABLED",
      "CODE OUTPUT отключён (STAGE 4.2). Дождись этапа 4.3+ или используй /repo_file /repo_get для чтения."
    )
  );
  return;

  // ---- B9: BAD_ARGS ----
  if (!path) {
    await bot.sendMessage(
      chatId,
      [
        refuseText("BAD_ARGS", "Формат: /code_fullfile <path/to/file.js> [requirement...]."),
        "Example:",
        "/code_fullfile src/x.js add helper for foo()",
      ].join("\n")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "BAD_ARGS" });
    } catch (_) {}
    return;
  }

  // ---- B9: SENSITIVE_PATH ----
  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот path запрещён (секреты/инфраструктура)."));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "SENSITIVE_PATH" });
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
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "INTERNAL_ERROR" });
    } catch (_) {}
    return;
  }

  // ---- B9: NO AI until enabled ----
  try {
    await logCodeOutputRefuse({
      chatId: String(chatId),
      senderId: String(senderIdStr || ""),
      command: "/code_fullfile",
      reason: "CODE_OUTPUT_DISABLED",
      path: path || null,
      details: {
        active_stage: "4",
        active_substage: "4.2",
        note: "Hard-blocked until CODE OUTPUT is explicitly enabled.",
      },
      snapshotId: null,
      mode: "DISABLED",
    });
  } catch (_) {}

  await bot.sendMessage(chatId, refuseText("CODE_OUTPUT_DISABLED", "CODE OUTPUT отключён. Сейчас только DRY_RUN."));
  return;

  // ---- fetch ----
  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  let currentFile = null;
  try {
    currentFile = await source.fetchTextFile(path);
  } catch (_) {}

  const fileText = currentFile?.content || "";

  if (!fileText) {
    await bot.sendMessage(chatId, refuseText("FILE_NOT_FOUND", "Файл не найден или не удалось прочитать из RepoSource."));
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "FILE_NOT_FOUND" });
    } catch (_) {}
    return;
  }

  if (fileText.length > MAX_FULLFILE_CHARS) {
    await bot.sendMessage(
      chatId,
      refuseText("FILE_TOO_LARGE", `Файл слишком большой (${fileText.length}). Лимит ${MAX_FULLFILE_CHARS}.`)
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: "FILE_TOO_LARGE" });
    } catch (_) {}
    return;
  }

  const system = [
    "Ты — аккуратный код-редактор.",
    "Верни ПОЛНЫЙ файл в строгом формате контракта FULLFILE:",
    "<<<FILE_START>>>",
    "<FULL FILE CONTENT>",
    "<<<FILE_END>>>",
    "Никакого лишнего текста. Только этот блок.",
    `Максимум символов файла: ${MAX_FULLFILE_CHARS}.`,
  ].join("\n");

  const user = [
    `PATH: ${path}`,
    "",
    "CURRENT FILE:",
    fileText,
    "",
    requirement ? `REQUIREMENT: ${requirement}` : "REQUIREMENT: (none)",
  ].join("\n");

  const raw = await callAI(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    "high",
    { max_output_tokens: 1400, temperature: 0.2 }
  );

  const vr = validateFullFile({ raw, maxChars: MAX_FULLFILE_CHARS, forbidMarkersInside: true });
  if (!vr.ok) {
    await bot.sendMessage(
      chatId,
      refuseText(`CONTRACT_FAIL:${vr.code}`, "Модель вернула неверный формат. Повтори запрос или уточни requirement.")
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...baseMeta, refuseReason: `CONTRACT_FAIL:${vr.code}` });
    } catch (_) {}
    return;
  }

  await bot.sendMessage(chatId, vr.fileText);
}
