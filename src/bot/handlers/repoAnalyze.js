// ============================================================================
// === src/bot/handlers/repoAnalyze.js — File analysis (NO CODE OUTPUT), B6.3
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

function has(pattern, code) {
  try {
    return new RegExp(pattern, "m").test(code);
  } catch {
    return false;
  }
}

function buildFindings({ path, code, lines }) {
  const risks = [];
  const notes = [];
  const suggestions = [];

  // Size / maintainability
  if (lines >= 300) {
    notes.push(`Большой файл (${lines} строк): повышен риск ошибок вставки/рефакторинга.`);
    suggestions.push(
      `Разбей файл на модули (правило: 200–300 строк = пора выносить ответственность).`
    );
  }

  // Dangerous APIs
  if (
    has("\\bchild_process\\b", code) ||
    has("\\bexec\\(", code) ||
    has("\\bspawn\\(", code)
  ) {
    risks.push(
      "Используется child_process/exec/spawn: риск RCE/инъекций и безопасности окружения."
    );
    suggestions.push(
      "Если это нужно — добавь строгий allowlist команд и запрети пользовательский ввод без фильтрации."
    );
  }

  // FS writes
  if (
    has("\\bfs\\.", code) &&
    (has("\\bwriteFile\\(", code) ||
      has("\\bappendFile\\(", code) ||
      has("\\bcreateWriteStream\\(", code))
  ) {
    risks.push(
      "Есть запись в файловую систему: риск утечек/перезаписи/побочных эффектов на Render."
    );
    suggestions.push(
      "Логи/артефакты — только в DB или безопасное хранилище; запись на диск делай осознанно и ограниченно."
    );
  }

  // Network calls
  if (has("\\bfetch\\(", code) || has("\\baxios\\b", code) || has("\\brequest\\b", code)) {
    notes.push(
      "Есть сетевые запросы: проверь timeouts, retries, rate-limit и обработку ошибок."
    );
    suggestions.push(
      "Добавь таймауты и явную обработку ошибок/429, чтобы не зависать и не спамить источники."
    );
  }

  // Secrets handling
  if (has("process\\.env\\.", code)) {
    notes.push("Используются переменные окружения (process.env): проверь, что не логируешь секреты.");
    suggestions.push(
      "Никогда не выводи значения process.env в чат/логи; логируй только факт наличия/отсутствия."
    );
  }

  // SQL / DB usage in wrong zones (heuristic)
  const isBootstrap = String(path || "").includes("src/bootstrap/");
  const isHandler = String(path || "").includes("src/bot/handlers/");
  if (
    (isBootstrap || isHandler) &&
    (has("\\bpool\\.query\\(", code) || has("\\bCREATE\\s+TABLE\\b", code))
  ) {
    risks.push("DB/DDL/SQL в bootstrap/handlers: нарушение границ (CORE_BOUNDARY_VIOLATION).");
    suggestions.push(
      "Вынеси DDL/DB-логику в db/service слой; в handlers/bootstrap оставь только вызовы."
    );
  }

  // Privileged commands guard (heuristic)
  if (
    isHandler &&
    (has("\\/reindex\\b", code) || has("\\/repo_review\\b", code) || has("\\/repo_diff\\b", code))
  ) {
    if (!has("MONARCH_CHAT_ID", code) && !has("requirePerm", code) && !has("permission", code)) {
      risks.push(
        "Похоже на привилегированную команду без явного permission-guard (PERMISSION_BYPASS_RISK)."
      );
      suggestions.push(
        "Добавь явный monarch/admin guard внутри handler, даже если guard уже есть на уровне router."
      );
    }
  }

  // Unreachable code heuristic (very rough)
  if (has("\\breturn\\s*;[\\s\\S]{0,400}\\breturn\\b", code)) {
    notes.push("Есть паттерны с ранними return: возможно UNREACHABLE_CODE (эвристика).");
  }

  return { risks, notes, suggestions };
}

export async function handleRepoAnalyze({ bot, chatId, rest }) {
  const path = (rest || "").trim();

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

  const { risks, notes, suggestions } = buildFindings({ path, code, lines });

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

