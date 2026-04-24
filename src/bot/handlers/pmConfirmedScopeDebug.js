// src/bot/handlers/pmConfirmedScopeDebug.js
// ============================================================================
// Project Memory confirmed scope debug flow
// Purpose:
// - thin Telegram adapter for debugging confirmed-memory scope distribution
// - read-only diagnostic path
// - show actual scope signatures present in confirmed memory
// - explain why a specific scope filter returns empty context
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = safeText(item);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function parseArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  const out = {
    limit: 200,
    moduleKey: null,
    stageKey: null,
    section: null,
    entryType: null,
    aiContext: undefined,
    projectArea: null,
    repoScope: null,
    linkedArea: null,
    linkedRepo: null,
    crossRepo: undefined,
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (/^\d+$/.test(token)) {
      out.limit = Number.parseInt(token, 10);
      continue;
    }

    if (lower.startsWith("module:")) {
      out.moduleKey = safeText(token.slice(7));
      continue;
    }

    if (lower.startsWith("stage:")) {
      out.stageKey = safeText(token.slice(6));
      continue;
    }

    if (lower.startsWith("section:")) {
      out.section = safeText(token.slice(8));
      continue;
    }

    if (lower.startsWith("type:")) {
      out.entryType = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("context:")) {
      out.aiContext = parseBooleanLike(token.slice(8), undefined);
      continue;
    }

    if (lower.startsWith("area:")) {
      out.projectArea = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("repo:")) {
      out.repoScope = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("linked_area:")) {
      out.linkedArea = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("linked_repo:")) {
      out.linkedRepo = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("cross_repo:")) {
      out.crossRepo = parseBooleanLike(token.slice(11), undefined);
      continue;
    }
  }

  return out;
}

function buildUsage() {
  return [
    "Использование: /pm_confirmed_scope_debug",
    "",
    "Показывает реальную scope-карту confirmed memory.",
    "Это read-only diagnostic команда.",
    "",
    "Поддерживаемые фильтры:",
    "module:<value>",
    "stage:<value>",
    "section:<value>",
    "type:<value>",
    "context:true|false",
    "area:<value>",
    "repo:<value>",
    "linked_area:<value>",
    "linked_repo:<value>",
    "cross_repo:true|false",
    "[число] = limit",
    "",
    "Примеры:",
    "/pm_confirmed_scope_debug",
    "/pm_confirmed_scope_debug 200",
    "/pm_confirmed_scope_debug area:core repo:core",
    "/pm_confirmed_scope_debug area:client repo:client cross_repo:false",
    "/pm_confirmed_scope_debug module:project_memory context:true",
    "",
    "Важно:",
    "- команда ничего не записывает",
    "- команда ничего не обновляет",
    "- команда показывает именно фактическую scope-раскладку записей",
  ].join("\n");
}

function buildFilterLabel(args = {}) {
  const parts = [];

  if (args.moduleKey) parts.push(`module=${args.moduleKey}`);
  if (args.stageKey) parts.push(`stage=${args.stageKey}`);
  if (args.section) parts.push(`section=${args.section}`);
  if (args.entryType) parts.push(`type=${args.entryType}`);
  if (typeof args.aiContext === "boolean") {
    parts.push(`context=${args.aiContext ? "yes" : "no"}`);
  }
  if (args.projectArea) parts.push(`area=${args.projectArea}`);
  if (args.repoScope) parts.push(`repo=${args.repoScope}`);
  if (args.linkedArea) parts.push(`linked_area=${args.linkedArea}`);
  if (args.linkedRepo) parts.push(`linked_repo=${args.linkedRepo}`);
  if (typeof args.crossRepo === "boolean") {
    parts.push(`cross_repo=${args.crossRepo ? "yes" : "no"}`);
  }

  return parts.length ? `[${parts.join(", ")}]` : "";
}

function getMeta(row) {
  return row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
    ? row.meta
    : {};
}

function getScopeSignature(row) {
  const meta = getMeta(row);

  const area = safeText(meta.projectArea) || "-";
  const repo = safeText(meta.repoScope) || "-";
  const linkedAreas = normalizeList(meta.linkedAreas);
  const linkedRepos = normalizeList(meta.linkedRepoScopes);
  const crossRepo = meta.crossRepo === true ? "yes" : "no";
  const aiContext = meta.aiContext === true ? "yes" : "no";

  return {
    area,
    repo,
    linkedAreas,
    linkedRepos,
    crossRepo,
    aiContext,
    key: [
      `area=${area}`,
      `repo=${repo}`,
      `cross_repo=${crossRepo}`,
      `ai_context=${aiContext}`,
      `linked_areas=${linkedAreas.join("|") || "-"}`,
      `linked_repos=${linkedRepos.join("|") || "-"}`,
    ].join(" ; "),
  };
}

function matchesRequestedScope(signature, args) {
  if (args.projectArea && signature.area.toLowerCase() !== safeText(args.projectArea).toLowerCase()) {
    return false;
  }

  if (args.repoScope && signature.repo.toLowerCase() !== safeText(args.repoScope).toLowerCase()) {
    return false;
  }

  if (args.linkedArea) {
    const target = safeText(args.linkedArea).toLowerCase();
    const found = signature.linkedAreas.some((item) => safeText(item).toLowerCase() === target);
    if (!found) return false;
  }

  if (args.linkedRepo) {
    const target = safeText(args.linkedRepo).toLowerCase();
    const found = signature.linkedRepos.some((item) => safeText(item).toLowerCase() === target);
    if (!found) return false;
  }

  if (typeof args.crossRepo === "boolean") {
    const want = args.crossRepo ? "yes" : "no";
    if (signature.crossRepo !== want) return false;
  }

  return true;
}

function compactText(text, maxChars = 160) {
  const s = safeText(text);
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "...";
}

function buildScopeMap(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const signature = getScopeSignature(row);

    if (!map.has(signature.key)) {
      map.set(signature.key, {
        signature,
        count: 0,
        sampleIds: [],
      });
    }

    const bucket = map.get(signature.key);
    bucket.count += 1;

    if (bucket.sampleIds.length < 5) {
      bucket.sampleIds.push(row.id);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.signature.key.localeCompare(b.signature.key);
  });
}

function hasRequestedScopeFilter(args = {}) {
  return (
    !!args.projectArea ||
    !!args.repoScope ||
    !!args.linkedArea ||
    !!args.linkedRepo ||
    typeof args.crossRepo === "boolean"
  );
}

function buildMessage(rows, args = {}) {
  const filterLabel = buildFilterLabel(args);
  const scopeMap = buildScopeMap(rows);
  const matchingRows = rows.filter((row) => matchesRequestedScope(getScopeSignature(row), args));
  const lines = [];

  lines.push(`🧠 Confirmed scope debug ${filterLabel || ""}`.trim());
  lines.push("");
  lines.push(`loaded_rows: ${rows.length}`);
  lines.push(`scope_signatures: ${scopeMap.length}`);
  lines.push(`matching_requested_scope: ${matchingRows.length}`);
  lines.push("");

  if (!scopeMap.length) {
    lines.push("Scope map: пусто.");
    return lines.join("\n");
  }

  lines.push("SCOPE MAP:");
  for (const item of scopeMap.slice(0, 20)) {
    lines.push(`- count=${item.count} | ids=${item.sampleIds.join(", ")}`);
    lines.push(`  ${item.signature.key}`);
  }

  lines.push("");

  if (hasRequestedScopeFilter(args)) {
    lines.push("MATCHING ROWS FOR REQUESTED SCOPE:");

    if (!matchingRows.length) {
      lines.push("- нет совпадений по точному scope-фильтру");
    } else {
      for (const row of matchingRows.slice(0, 10)) {
        const signature = getScopeSignature(row);
        lines.push(
          `- id=${row.id} | type=${safeText(row.entry_type) || "-"} | section=${safeText(row.section) || "-"}`
        );
        lines.push(`  ${signature.key}`);
        if (safeText(row.title)) {
          lines.push(`  title: ${safeText(row.title)}`);
        }
        lines.push(`  text: ${compactText(row.content)}`);
      }
    }

    lines.push("");
  }

  lines.push("TOP ROWS:");
  for (const row of rows.slice(0, 10)) {
    const signature = getScopeSignature(row);
    lines.push(
      `- id=${row.id} | type=${safeText(row.entry_type) || "-"} | section=${safeText(row.section) || "-"}`
    );
    lines.push(`  ${signature.key}`);
    if (safeText(row.title)) {
      lines.push(`  title: ${safeText(row.title)}`);
    }
    lines.push(`  text: ${compactText(row.content)}`);
  }

  return lines.join("\n").trim();
}

async function sendChunked(bot, chatId, title, content) {
  const SAFE_LIMIT = 3800;
  const header = safeText(title);
  const text = String(content ?? "");

  if (!text) {
    await bot.sendMessage(chatId, header || "Пусто.");
    return;
  }

  const full = header ? `${header}\n\n${text}` : text;

  if (full.length <= SAFE_LIMIT) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const parts = [];
  let cursor = 0;

  while (cursor < text.length) {
    parts.push(text.slice(cursor, cursor + 3000));
    cursor += 3000;
  }

  for (let i = 0; i < parts.length; i++) {
    const prefix = header
      ? `${header}\nчасть ${i + 1}/${parts.length}\n\n`
      : `часть ${i + 1}/${parts.length}\n\n`;

    const available = Math.max(500, SAFE_LIMIT - prefix.length);
    const body = parts[i].slice(0, available);

    await bot.sendMessage(chatId, prefix + body);
  }
}

export async function handlePmConfirmedScopeDebug({
  bot,
  chatId,
  rest,
  listConfirmedProjectMemoryEntries,
}) {
  if (typeof listConfirmedProjectMemoryEntries !== "function") {
    await bot.sendMessage(chatId, "⛔ listConfirmedProjectMemoryEntries недоступен.");
    return;
  }

  const text = safeText(rest);

  if (text === "help" || text === "--help" || text === "-h") {
    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  try {
    const args = parseArgs(rest);

    const rows = await listConfirmedProjectMemoryEntries({
      limit: Number.isInteger(args.limit) ? args.limit : 200,
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
      aiContext: args.aiContext,
      projectArea: args.projectArea,
      repoScope: args.repoScope,
      linkedArea: args.linkedArea,
      linkedRepo: args.linkedRepo,
      crossRepo: args.crossRepo,
    });

    const message = buildMessage(rows, args);
    await sendChunked(bot, chatId, "", message);
  } catch (e) {
    console.error("❌ /pm_confirmed_scope_debug error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка scope-debug confirmed memory.");
  }
}

export default {
  handlePmConfirmedScopeDebug,
};