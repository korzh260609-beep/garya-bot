// ============================================================================
// === src/bot/handlers/repoAnalyze.js — READ-ONLY file analysis (NO CODE OUTPUT)
// === B6: /repo_analyze <path> [question...]
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { RepoSource } from "../../repo/RepoSource.js";

// ---------------------------------------------------------------------------
// Permission guard (monarch-only) — Stage 4: identity-first (MONARCH_USER_ID)
// ---------------------------------------------------------------------------
async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }
  return true;
}

function normalizePath(raw) {
  const p = String(raw || "").trim().replace(/^\/+/, "");
  if (!p) return "";
  // block traversal
  if (p.includes("..")) return "";
  return p;
}

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

  // блокируем конфиги окружений/деплоя (чтобы никто не “анализировал” их содержимое)
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

function countMatches(pattern, text) {
  try {
    const re = new RegExp(pattern, "gm");
    const m = String(text || "").match(re);
    return m ? m.length : 0;
  } catch {
    return 0;
  }
}

function parsePathAndQuestion(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return { path: "", question: "" };

  // формат: /repo_analyze path/to/file.js [question...]
  const firstSpace = raw.indexOf(" ");
  if (firstSpace === -1) return { path: raw, question: "" };

  const path = raw.slice(0, firstSpace).trim();
  const question = raw.slice(firstSpace + 1).trim();
  return { path, question };
}

function buildMetrics({ path, code, lines }) {
  // Без вывода кода: только метрики/флаги
  const imports =
    countMatches("^\\s*import\\s+", code) +
    countMatches("^\\s*const\\s+\\w+\\s*=\\s*require\\(", code);
  const exportsCount =
    countMatches("^\\s*export\\s+", code) +
    countMatches("module\\.exports\\s*=", code) +
    countMatches("exports\\.", code);

  const funcs =
    countMatches("\\bfunction\\s+\\w+\\s*\\(", code) +
    countMatches("\\basync\\s+function\\s+\\w+\\s*\\(", code);
  const arrowFns = countMatches("\\bconst\\s+\\w+\\s*=\\s*\\(.*?\\)\\s*=>", code);
  const classes = countMatches("\\bclass\\s+\\w+\\b", code);

  const hasEnv = reTest("\\bprocess\\.env\\.", code);
  const hasNet = reTest("\\bfetch\\(", code) || reTest("\\baxios\\b", code) || reTest("\\brequest\\b", code);
  const hasFsWrite =
    reTest("\\bfs\\.", code) &&
    (reTest("\\bwriteFile\\(", code) ||
      reTest("\\bappendFile\\(", code) ||
      reTest("\\bcreateWriteStream\\(", code));
  const hasChildProc = reTest("\\bchild_process\\b", code) || reTest("\\bexec\\(", code) || reTest("\\bspawn\\(", code);

  const isBootstrap = String(path || "").includes("src/bootstrap/");
  const isHandler = String(path || "").includes("src/bot/handlers/");
  const touchesDb = reTest("\\bpool\\.query\\(", code) || reTest("\\bCREATE\\s+TABLE\\b", code);

  return {
    lines,
    imports,
    exportsCount,
    funcs,
    arrowFns,
    classes,
    flags: {
      hasEnv,
      hasNet,
      hasFsWrite,
      hasChildProc,
      touchesDb,
      isBootstrap,
      isHandler,
    },
  };
}

function buildFindings({ metrics, code }) {
  const notes = [];
  const risks = [];
  const suggestions = [];

  const lines = metrics.lines;

  // размер
  if (lines >= 300) {
    notes.push(`Большой файл (${lines} строк): повышен риск ошибок и сложность поддержки.`);
    suggestions.push("Разбей файл на модули (правило проекта: 200–300 строк = пора выносить ответственность).");
  }

  // env
  if (metrics.flags.hasEnv) {
    notes.push("Используются переменные окружения (process.env): убедись, что секреты не логируются.");
    suggestions.push("Не выводи значения process.env в чат/логи; логируй только факт наличия/отсутствия.");
  }

  // child_process
  if (metrics.flags.hasChildProc) {
    risks.push("Используется child_process/exec/spawn: риск RCE/инъекций при неверной фильтрации ввода.");
    suggestions.push("Только allowlist команд и жёсткая валидация; запрет пользовательских строк без фильтра.");
  }

  // fs write
  if (metrics.flags.hasFsWrite) {
    risks.push("Есть запись в файловую систему: риск побочных эффектов/утечек/нестабильности на Render.");
    suggestions.push("Данные/логи — предпочтительно в БД/безопасное хранилище; запись на диск только осознанно.");
  }

  // network
  if (metrics.flags.hasNet) {
    notes.push("Есть сетевые запросы: проверь timeout/retry/rate-limit и обработку ошибок.");
    suggestions.push("Добавь таймауты и обработку 429/5xx, чтобы не зависать и не спамить источники.");
  }

  // boundary checks
  if ((metrics.flags.isBootstrap || metrics.flags.isHandler) && metrics.flags.touchesDb) {
    risks.push("DB/SQL в bootstrap/handlers: вероятное нарушение границ ответственности (CORE_BOUNDARY_VIOLATION).");
    suggestions.push("Вынеси DB-операции в service слой; handlers/bootstrap держи тонкими.");
  }

  // privileged commands inside handler check (heuristic)
  if (
    metrics.flags.isHandler &&
    (reTest("\\/reindex\\b", code) || reTest("\\/repo_review\\b", code) || reTest("\\/repo_diff\\b", code) || reTest("\\/repo_", code))
  ) {
    if (!reTest("MONARCH_USER_ID", code) && !reTest("MONARCH_CHAT_ID", code) && !reTest("requirePerm", code) && !reTest("perm", code)) {
      risks.push("Похоже на привилегированную команду без явного permission-guard в handler (PERMISSION_BYPASS_RISK).");
      suggestions.push("Добавь явный guard внутри handler (даже если guard есть на уровне router).");
    }
  }

  // unreachable heuristic (non-blocking)
  if (reTest("\\breturn\\b[\\s\\S]{0,400}\\breturn\\b", code)) {
    notes.push("Есть паттерны с ранними return: возможен UNREACHABLE_CODE (эвристика, non-blocking).");
  }

  return { notes, risks, suggestions };
}

function buildQuestionFocus(question) {
  const q = String(question || "").trim();
  if (!q) return null;

  // очень простой “фокус”, чтобы ответ был точечным без ИИ
  return `Фокус-вопрос: ${q}`;
}

export async function handleRepoAnalyze(ctx) {
  const { bot, chatId, senderIdStr, rest } = ctx || {};

  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const parsed = parsePathAndQuestion(rest);
  const path = normalizePath(parsed.path);
  const question = parsed.question;

  if (!path) {
    await bot.sendMessage(chatId, "Usage: /repo_analyze <path/to/file.js> [question...]");
    return;
  }

  if (denySensitivePath(path)) {
    await bot.sendMessage(chatId, "Access denied: sensitive path.");
    return;
  }

  // Snapshot gate: анализируем только то, что есть в текущем snapshot
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, "RepoAnalyze: no snapshots yet (run /reindex first)");
    return;
  }

  const existsRes = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [latest.id, path]
  );

  if (!existsRes.rows || existsRes.rows.length === 0) {
    await bot.sendMessage(
      chatId,
      [
        `RepoAnalyze: blocked (path not in snapshot)`,
        `snapshotId: ${latest.id}`,
        `path: ${path}`,
        `Tip: use /repo_tree or /reindex`,
      ].join("\n")
    );
    return;
  }

  const source = new RepoSource({
    repo,
    branch,
    token: process.env.GITHUB_TOKEN,
  });

  const file = await source.fetchTextFile(path);
  if (!file || typeof file.content !== "string") {
    await bot.sendMessage(chatId, `File not found or cannot be read: ${path}`);
    return;
  }

  const code = file.content;
  const lines = countLines(code);

  // Метрики + эвристики (без вывода кода)
  const metrics = buildMetrics({ path, code, lines });
  const { notes, risks, suggestions } = buildFindings({ metrics, code });

  const out = [];
  out.push(`repo_analyze: ${path}`);
  out.push(`snapshotId: ${latest.id}`);
  out.push(`lines: ${metrics.lines}`);
  out.push(
    `metrics: imports=${metrics.imports}, exports=${metrics.exportsCount}, functions=${metrics.funcs + metrics.arrowFns}, classes=${metrics.classes}`
  );
  out.push("");

  out.push("IMPORTANT: file content is NOT printed by this command.");
  const focus = buildQuestionFocus(question);
  if (focus) out.push(focus);
  out.push("");

  out.push("Notes:");
  if (!notes.length) out.push("- (none)");
  else notes.slice(0, 12).forEach((n) => out.push(`- ${n}`));

  out.push("");
  out.push("Risks:");
  if (!risks.length) out.push("- (none)");
  else risks.slice(0, 12).forEach((r) => out.push(`- ${r}`));

  out.push("");
  out.push("Suggestions (READ-ONLY):");
  if (!suggestions.length) out.push("- (none)");
  else suggestions.slice(0, 12).forEach((s) => out.push(`- ${s}`));

  // Если задан вопрос — добавим “минимально достаточные” подсказки по фокусу (без ИИ)
  if (question) {
    out.push("");
    out.push("Focus hints:");
    const q = question.toLowerCase();

    if (q.includes("security") || q.includes("guard") || q.includes("access") || q.includes("роль")) {
      out.push("- Проверь, что команды/действия в этом файле не обходят dev-gate и requirePerm.");
      out.push("- Убедись, что монарх определяется только через MONARCH_USER_ID (env), без доверия к роли из БД.");
    } else if (q.includes("boundary") || q.includes("архит") || q.includes("слой") || q.includes("module")) {
      out.push("- Проверь, что handler не тянет DB/Repo/AI напрямую, а делегирует в сервисы.");
      out.push("- Проверь, что импорты не создают циклы между слоями.");
    } else if (q.includes("bug") || q.includes("ошиб") || q.includes("падает") || q.includes("crash")) {
      out.push("- Ищи места, где функции ожидаются как функции (не boolean), особенно isMonarch/callAI.");
      out.push("- Проверь try/catch вокруг внешних вызовов (GitHub/AI/DB) и наличие return после reply.");
    } else {
      out.push("- Уточни вопрос (1–2 фразы), если нужен более точный анализ по конкретному сценарию.");
    }
  }

  await bot.sendMessage(chatId, out.join("\n"));
}
