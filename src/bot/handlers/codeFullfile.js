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

  // safe single
  if (single.length <= TG_MAX_SAFE) {
    await bot.sendMessage(chatId, single);
    return;
  }

  // chunked
  const parts = chunkString(content, TG_MAX_SAFE);
  const capped = parts.slice(0, TG_MAX_PARTS);

  await bot.sendMessage(chatId, `${header}\n(частями: ${capped.length}/${parts.length})`);

  for (let i = 0; i < capped.length; i++) {
    const part = capped[i];
    const msg = `part ${i + 1}/${capped.length}\n\n\`\`\`${codeBlockLang}\n${part}\n\`\`\``;
    await bot.sendMessage(chatId, msg);
  }

  if (parts.length > TG_MAX_PARTS) {
    await bot.sendMessage(
      chatId,
      refuseText(
        "TG_LIMIT",
        `Файл слишком большой для Telegram. Получилось ${parts.length} частей, лимит ${TG_MAX_PARTS}. Сузь запрос или попроси конкретный фрагмент.`
      )
    );
  }
}

export async function handleCodeFullfile(ctx) {
  const { bot, chatId, rest, callAI, senderIdStr } = ctx || {};
  const { path, requirement } = parsePathAndRequirement(rest);

  const aiMetaBase = {
    handler: "codeFullfile",
    event: "CODE_FULLFILE",
    chatId: String(chatId),
    path,
    hasRequirement: Boolean(requirement),
  };

  // ==========================================================================
  // STAGE 12A / 4.4 — DRY_RUN (CODE_OUTPUT остаётся DISABLED)
  // Rule: validate request (permissions + private chat + path/limits + format contract) WITHOUT AI/Repo/DB.
  // Returns: DRY_RUN_OK or REFUSE.
  // ==========================================================================
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "");
  const isMonarch = String(senderIdStr || "") === MONARCH_USER_ID;

  // In Telegram private chat: chat.id === senderId (practical guard)
  const isPrivateLike = String(chatId) === String(senderIdStr || "");

  // ---- 4.4: PERMISSION + CHAT GUARDS ----
  if (!isMonarch) {
    try {
      await logCodeOutputRefuse({
        chatId: String(chatId),
        senderId: String(senderIdStr || ""),
        command: "/code_fullfile",
        reason: "DRY_RUN_NOT_MONARCH",
        path: path || null,
        details: { active_stage: "4", active_substage: "4.4", note: "DRY_RUN доступен только монарху." },
        snapshotId: null,
        mode: "DRY_RUN",
      });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("NOT_ALLOWED", "Только монарх может использовать CODE OUTPUT (даже DRY_RUN)."));
    return;
  }

  if (!isPrivateLike) {
    try {
      await logCodeOutputRefuse({
        chatId: String(chatId),
        senderId: String(senderIdStr || ""),
        command: "/code_fullfile",
        reason: "DRY_RUN_NOT_PRIVATE_CHAT",
        path: path || null,
        details: { active_stage: "4", active_substage: "4.4", note: "DRY_RUN разрешён только в личке." },
        snapshotId: null,
        mode: "DRY_RUN",
      });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("PRIVATE_ONLY", "Используй команду только в личном чате с SG."));
    return;
  }

  // ---- 4.4: ARG + PATH + LIMITS ----
  if (!path) {
    await bot.sendMessage(chatId, refuseText("BAD_ARGS", "Формат: /code_fullfile <path/to/file.js> [requirement...]"));
    return;
  }

  if (String(path).length > 300) {
    await bot.sendMessage(chatId, refuseText("PATH_TOO_LONG", "Сократи path (≤ 300 символов)."));
    return;
  }

  if (denySensitivePath(path)) {
    try {
      await logCodeOutputRefuse({
        chatId: String(chatId),
        senderId: String(senderIdStr || ""),
        command: "/code_fullfile",
        reason: "DRY_RUN_SENSITIVE_PATH",
        path: path || null,
        details: { active_stage: "4", active_substage: "4.4" },
        snapshotId: null,
        mode: "DRY_RUN",
      });
    } catch (_) {}

    await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот path запрещён (секреты/инфраструктура)."));
    return;
  }

  const dangerous = (s) => {
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

  if (dangerous(requirement)) {
    await bot.sendMessage(chatId, refuseText("DANGEROUS_REQUIREMENT", "Убери упоминания секретов/ключей из requirement."));
    return;
  }

  // ---- 4.4: FORMAT CONTRACT CHECK (logical) ----
  // We do NOT call AI here. We only confirm that FULLFILE contract is the required output format.
  // (Actual validateFullFile(raw) is applied later, in Stage 4.5+ when generation is enabled.)

  await bot.sendMessage(
    chatId,
    [
      "DRY_RUN_OK",
      `mode: fullfile`,
      `path: ${path}`,
      `contract: FULLFILE (<<<FILE_START>>> … <<<FILE_END>>>)`,
      "ai: not_called | repo: not_read | db: not_written",
    ].join("\n")
  );
  return;
  // ==========================================================================

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
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "BAD_ARGS" });
    } catch (_) {}
    return;
  }

  // ---- B9: SENSITIVE_PATH ----
  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, refuseText("SENSITIVE_PATH", "Этот path запрещён (секреты/инфраструктура)."));
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "SENSITIVE_PATH" });
    } catch (_) {}
    return;
  }

  // ---- B9: FETCH_FAIL ----
  const source = new RepoSource();
  const fileText = await safeFetchText(source, path);
  if (!fileText) {
    await bot.sendMessage(chatId, refuseText("FILE_NOT_FOUND", "Файл не найден или не удалось прочитать из RepoSource."));
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "FILE_NOT_FOUND" });
    } catch (_) {}
    return;
  }

  // ---- B8: size limit ----
  if (fileText.length > MAX_FULLFILE_CHARS) {
    await bot.sendMessage(
      chatId,
      refuseText("FILE_TOO_LARGE", `Файл слишком большой (${fileText.length}). Лимит ${MAX_FULLFILE_CHARS}.`)
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: "FILE_TOO_LARGE" });
    } catch (_) {}
    return;
  }

  // ---- AI CALL (only after enable) ----
  const lang = guessLang(path);

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

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  // ---- Contract validate ----
  const vr = validateFullFile({ raw, maxChars: MAX_FULLFILE_CHARS, forbidMarkersInside: true });
  if (!vr.ok) {
    await bot.sendMessage(
      chatId,
      refuseText(
        `CONTRACT_FAIL:${vr.code}`,
        "Модель вернула неверный формат. Повтори запрос или уточни requirement."
      )
    );
    try {
      console.info("🧾 CODE_REFUSE", { ...aiMetaBase, refuseReason: `CONTRACT_FAIL:${vr.code}` });
    } catch (_) {}
    return;
  }

  const header = `<<<FILE_START>>> (path: ${path})`;
  await sendInParts(bot, chatId, header, lang, vr.fileText);
}
