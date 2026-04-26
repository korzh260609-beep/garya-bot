// src/bot/handlers/pmConfirmedWrite.js
// ============================================================================
// Project Memory confirmed write flow
// Purpose:
// - thin Telegram adapter for confirmed project memory writes
// - no business logic here
// - parse input -> validate -> call universal confirmed writer
// - render returned universal metadata without deciding policy in transport
// ============================================================================

import { buildConfirmedMemorySavedMessage } from "./pmConfirmedRender.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function splitItems(value = "") {
  return String(value ?? "")
    .split(/\s*\|\s*/)
    .map((item) => safeText(item))
    .filter(Boolean);
}

function pickLine(map, ...keys) {
  for (const key of keys) {
    if (safeText(map[key])) return safeText(map[key]);
  }
  return "";
}

function traceWriteAttempt({
  chatId,
  chatIdStr,
  bypass,
  phase,
  reason,
  kind,
  hasContent,
} = {}) {
  console.log("🧠 PROJECT_MEMORY_CONFIRMED_WRITE_ATTEMPT", {
    transport: "telegram",
    chatId: safeText(chatIdStr || chatId),
    bypass: !!bypass,
    phase: safeText(phase) || "unknown",
    reason: safeText(reason) || null,
    kind: safeText(kind) || null,
    hasContent: !!hasContent,
  });
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function parseConfirmedWriteInput(rest = "") {
  const text = safeText(rest);

  if (!text) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line ?? ""))
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return null;
  }

  const map = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.*)$/);

    if (!match) continue;

    const rawKey = safeText(match[1]).toLowerCase().replace(/\s+/g, "_");
    const rawValue = safeText(match[2]);

    map[rawKey] = rawValue;
  }

  const kind = pickLine(map, "kind", "type", "entry_type");
  const section = pickLine(map, "section");
  const title = pickLine(map, "title", "name");
  const content = pickLine(map, "content", "text", "body");
  const moduleKey = pickLine(map, "module", "module_key");
  const stageKey = pickLine(map, "stage", "stage_key");
  const sourceRef = pickLine(map, "source", "source_ref");

  const tags = splitItems(pickLine(map, "tags", "tag"));
  const relatedPaths = splitItems(pickLine(map, "paths", "related_paths", "files"));
  const aiContext = parseBooleanLike(
    pickLine(map, "context", "ai_context", "use_in_context"),
    undefined
  );

  const projectArea = pickLine(map, "area", "project_area");
  const repoScope = pickLine(map, "repo", "repo_scope");
  const linkedAreas = splitItems(pickLine(map, "linked_areas", "areas"));
  const linkedRepoScopes = splitItems(pickLine(map, "linked_repos", "linked_repo_scopes"));
  const crossRepo = parseBooleanLike(pickLine(map, "cross_repo"), undefined);

  return {
    kind,
    section,
    title,
    content,
    moduleKey,
    stageKey,
    sourceRef,
    tags,
    relatedPaths,
    aiContext,
    projectArea,
    repoScope,
    linkedAreas,
    linkedRepoScopes,
    crossRepo,
  };
}

function buildUsage() {
  return [
    "Использование: /pm_confirmed_write",
    "",
    "Обязательные поля:",
    "kind: section_state | decision | constraint | next_step",
    "content: текст записи",
    "",
    "Multi-repo поля:",
    "area: core | client | shared | infra | docs | connectors | kingdom_overlay",
    "repo: core | client | shared",
    "cross_repo: yes | no",
    "linked_areas: core | client",
    "linked_repos: core | client",
    "",
    "AI context:",
    "context: yes | no",
    "",
    "Правило:",
    "- section_state по умолчанию НЕ идёт в AI context",
    "- decision / constraint / next_step по умолчанию идут в AI context",
    "",
    "Пример:",
    "kind: decision",
    "title: Cross-repo API contract",
    "content: Core and client must keep one stable task payload contract.",
    "area: shared",
    "repo: shared",
    "cross_repo: yes",
    "linked_areas: core | client",
    "linked_repos: core | client",
    "context: yes",
    "module: task_engine",
    "stage: 7A",
    "",
    "Разделитель списков: |",
  ].join("\n");
}

export async function handlePmConfirmedWrite({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  writeConfirmedProjectMemory,
}) {
  traceWriteAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "received",
  });

  if (typeof writeConfirmedProjectMemory !== "function") {
    traceWriteAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "writer_unavailable",
    });

    await bot.sendMessage(chatId, "⛔ writeConfirmedProjectMemory недоступен.");
    return;
  }

  if (!bypass) {
    traceWriteAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "not_trusted_path",
    });

    await bot.sendMessage(
      chatId,
      "⛔ Durable Project Memory write доступен только монарху / trusted path."
    );
    return;
  }

  const parsed = parseConfirmedWriteInput(rest);

  if (!parsed || !parsed.kind || !parsed.content) {
    traceWriteAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "invalid_input",
      kind: parsed?.kind,
      hasContent: !!parsed?.content,
    });

    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  traceWriteAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "accepted",
    kind: parsed.kind,
    hasContent: true,
  });

  try {
    const saved = await writeConfirmedProjectMemory({
      kind: parsed.kind,
      section: parsed.section || undefined,
      title: parsed.title || null,
      content: parsed.content,
      tags: parsed.tags,
      sourceType: "manual",
      sourceRef: parsed.sourceRef || `telegram:${safeText(chatIdStr || chatId)}`,
      relatedPaths: parsed.relatedPaths,
      moduleKey: parsed.moduleKey || null,
      stageKey: parsed.stageKey || null,
      aiContext: parsed.aiContext,

      projectArea: parsed.projectArea || null,
      repoScope: parsed.repoScope || null,
      linkedAreas: parsed.linkedAreas,
      linkedRepoScopes: parsed.linkedRepoScopes,
      crossRepo: parsed.crossRepo,

      meta: {
        transport: "telegram",
        manual: true,
        bypass: !!bypass,
        chatId: safeText(chatIdStr || chatId),
      },
    });

    await bot.sendMessage(chatId, buildConfirmedMemorySavedMessage(saved));
  } catch (e) {
    console.error("❌ /pm_confirmed_write error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка записи confirmed project memory.");
  }
}

export default {
  handlePmConfirmedWrite,
};