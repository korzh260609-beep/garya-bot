// ============================================================================
// === src/bot/handlers/repoAnalyze.js — READ-ONLY file analysis (NO CODE OUTPUT)
// === B6.3: /repo_analyze <path>
// ============================================================================

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

function countLines(s) {
  return String(s || "").split(/\r?\n/).length;
}

function reTest(pattern, text) {
  try {
    return new RegExp(pattern, "m").test(text);
  } catch {
    return false;
  }
}

function buildFindings({ path, code, lines }) {
  const notes = [];
  const risks = [];
  const suggestions = [];

  if (lines >= 300) {
    notes.push(`Большой файл (${lines} строк): повышен риск ошибок и сложность поддержки.`);
    suggestions.push(
      "Разбей файл на модули (правило проекта: 200–300 строк = пора выносить ответственность)."
    );
  }

  if (reTest("\\bprocess\\.env\\.", code)) {
    notes.push("Используются переменные окружения (process.env): убедись, что секреты не логируются.");
    suggestions.push("Не выводи значения process.env в чат/логи; логируй только факт наличия/отсутствия.");
  }

  if (reTest("\\bchild_process\\b", code) || reTest("\\bexec\\(", code) || reTest("\\bspawn\\(", code)) {
    risks.push("Используется child_process/exec/spawn: риск RCE/инъекций при неверной фильтрации ввода.");
    suggestions.push("Если нужно — только allowlist команд, запрет пользовательских строк без жёсткой валидации.");
  }

  if (
    reTest("\\bfs\\.", code) &&
    (reTest("\\bwriteFile\\(", code) || reTest("\\bappendFile\\(", code) || reTest("\\bcreateWriteStream\\(", code))
  ) {
    risks.push("Есть запись в файловую систему: риск побочных эффектов/утечек/нестабильности на Render.");
    suggestions.push("Данные и логи — предпочтительно в БД/безопасное хранилище; запись на диск только осознанно и ограниченно.");
  }

  if (reTest("\\bfetch\\(", code) || reTest("\\baxios\\b", code) || reTest("\\brequest\\b", code)) {
    notes.push("Есть сетевые запросы: проверь timeout/retry/rate-limit и обработку ошибок.");
    suggestions.push("Добавь таймауты и явную обработку ошибок/429, чтобы не зависать и не спамить источники.");
  }

  const isBootstrap = String(path || "").includes("src/bootstrap/");
  const isHandler = String(path || "").includes("src/bot/handlers/");
  if ((isBootstrap || isHandler) && (reTest("\\bpool\\.query\\(", code) || reTest("\\bCREATE\\s+TABLE\\b", code))) {
    risks.push("DB/DDL/SQL в bootstrap/handlers: вероятное нарушение границ ответственности (CORE_BOUNDARY_VIOLATION).");
    suggestions.push("Вынеси DB/DDL в db/service слой; handlers/bootstrap должны оставаться тонкими.");
  }

  if (isHandler && (reTest("\\/reindex\\b", code) || reTest("\\/repo_review\\b", code) || reTest("\\/repo_diff\\b", code))) {
    if (!reTest("MONARCH_CHAT_ID", code) && !reTest("requirePerm", code) && !reTest("perm", code)) {
      risks.push("Похоже на привилегированную команду без явного permission-guard (PERMISSION_BYPASS_RISK).");
      suggestions.push("Добавь явный guard внутри handler (даже если guard есть на уровне router).");
    }
  }

  if (reTest("\\breturn\\b[\\s\\S]{0,400}\\breturn\\b", code)) {
    notes.push("Есть паттерны с ранними return: возможно UNREACHABLE_CODE (эвристика, non-blocking).");
  }

  return { notes, risks, suggestions };
}

export async function handleRepoAnalyze(ctx) {
  const { bot, chatId, rest } = ctx || {};
  const path = String(rest || "").trim();

  if (!path) {
    await bot.sendMessage(chatId, "Usage: /repo_analyze <path/to/file.js>");
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, "Access denied: sensitive file.");
    return;
  }

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const file = await source.fetchTextFile(path);
  if (!file || typeof file.content !== "string") {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  const code = file.content;
  const lines = countLines(code);
  const { notes, risks, suggestions } = buildFindings({ path, code, lines });

  const out = [];
  out.push(`repo_analyze: ${path}`);
  out.push(`lines: ${lines}`);
  out.push("");
  out.push("IMPORTANT: file content is NOT printed by this command.");
  out.push("");

  out.push("Notes:");
  if (!notes.length) out.push("- (none)");
  else notes.slice(0, 10).forEach((n) => out.push(`- ${n}`));

  out.push("");
  out.push("Risks:");
  if (!risks.length) out.push("- (none)");
  else risks.slice(0, 10).forEach((r) => out.push(`- ${r}`));

  out.push("");
  out.push("Suggestions (READ-ONLY):");
  if (!suggestions.length) out.push("- (none)");
  else suggestions.slice(0, 10).forEach((s) => out.push(`- ${s}`));

  await bot.sendMessage(chatId, out.join("\n"));
}
