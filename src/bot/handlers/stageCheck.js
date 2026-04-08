// ============================================================================
// src/bot/handlers/stageCheck.js
// READ-ONLY STAGE CHECK
// - no AI
// - no DB required
// - source of truth: WORKFLOW.md + STAGE_CHECK_RULES.json + repo files
// ============================================================================

import fs from "fs";
import path from "path";
import { requireMonarchAccess } from "./handlerAccess.js";

const WORKFLOW_PATH = path.resolve("pillars/WORKFLOW.md");
const RULES_PATH = path.resolve("pillars/STAGE_CHECK_RULES.json");

function safeReadText(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, "utf8");
  } catch (_) {
    return null;
  }
}

function loadWorkflowText() {
  const raw = safeReadText(WORKFLOW_PATH);
  if (!raw) {
    throw new Error("WORKFLOW.md not found");
  }
  return raw;
}

function loadRules() {
  const raw = safeReadText(RULES_PATH);
  if (!raw) {
    return { version: 1, stages: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? parsed
      : { version: 1, stages: {} };
  } catch {
    throw new Error("STAGE_CHECK_RULES.json invalid JSON");
  }
}

function normalizeStageKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^STAGE\s+/i, "")
    .replace(/\s+/g, "");
}

function parseWorkflowStages(workflowText) {
  const lines = String(workflowText || "").split(/\r?\n/);
  const stages = [];

  for (const line of lines) {
    const match = line.match(/^#\s+STAGE\s+(.+?)\s+—\s+(.+)$/);
    if (!match) continue;

    const rawKey = String(match[1] || "").trim();
    const title = String(match[2] || "").trim();

    stages.push({
      key: normalizeStageKey(rawKey),
      rawKey,
      title,
    });
  }

  return stages;
}

function fileExists(relPath) {
  try {
    return fs.existsSync(path.resolve(relPath));
  } catch {
    return false;
  }
}

function fileContains(relPath, needle) {
  const text = safeReadText(path.resolve(relPath));
  if (!text) return false;
  return String(text).includes(String(needle || ""));
}

function runSingleCheck(check) {
  const type = String(check?.type || "").trim();
  const label = String(check?.label || "").trim() || type;

  if (type === "path_exists") {
    const ok = fileExists(check.path);
    return {
      ok,
      label,
      detail: ok ? String(check.path) : `missing path: ${check.path}`,
    };
  }

  if (type === "file_contains") {
    const ok = fileContains(check.path, check.value);
    return {
      ok,
      label,
      detail: ok
        ? `${check.path} contains required marker`
        : `missing marker in ${check.path}: ${check.value}`,
    };
  }

  return {
    ok: false,
    label,
    detail: `unknown check type: ${type}`,
  };
}

function computeStageStatus(results = [], hasRules = false) {
  if (!hasRules) return "no_rules";
  if (!Array.isArray(results) || results.length === 0) return "no_rules";

  const okCount = results.filter((x) => x.ok).length;
  if (okCount === results.length) return "done";
  if (okCount === 0) return "todo";
  return "partial";
}

function summarizeStage(stage, rules) {
  const cfg = rules?.stages?.[stage.key] || null;
  const checks = Array.isArray(cfg?.checks) ? cfg.checks : [];
  const results = checks.map(runSingleCheck);
  const status = computeStageStatus(results, Boolean(cfg));

  return {
    key: stage.key,
    rawKey: stage.rawKey,
    title: cfg?.title || stage.title,
    status,
    results,
  };
}

function buildSingleStageReply(summary) {
  const doneItems = summary.results.filter((x) => x.ok).map((x) => x.label);
  const missingItems = summary.results.filter((x) => !x.ok).map((x) => x.label);

  const lines = [];
  lines.push(`STAGE ${summary.rawKey} — ${summary.status}`);
  lines.push(summary.title);

  if (summary.status === "no_rules") {
    lines.push("");
    lines.push("Правила проверки для этого этапа ещё не заданы.");
    return lines.join("\n").slice(0, 3900);
  }

  if (doneItems.length > 0) {
    lines.push("");
    lines.push("Готово:");
    for (const item of doneItems.slice(0, 8)) {
      lines.push(`- ${item}`);
    }
  }

  if (missingItems.length > 0) {
    lines.push("");
    lines.push("Не готово:");
    for (const item of missingItems.slice(0, 8)) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n").slice(0, 3900);
}

function buildAllStagesReply(summaries = []) {
  const lines = [];

  for (const summary of summaries) {
    lines.push(`STAGE ${summary.rawKey} — ${summary.status}`);

    if (summary.status === "partial" || summary.status === "todo") {
      const missingItems = summary.results
        .filter((x) => !x.ok)
        .map((x) => x.label)
        .slice(0, 2);

      if (missingItems.length > 0) {
        lines.push(`не хватает: ${missingItems.join("; ")}`);
      }
    } else if (summary.status === "no_rules") {
      lines.push("не хватает: rules");
    }

    lines.push("");
  }

  return lines.join("\n").trim().slice(0, 3900);
}

function buildCurrentStageReply(summaries = []) {
  const firstOpen = summaries.find(
    (x) => x.status === "partial" || x.status === "todo" || x.status === "no_rules"
  );

  if (!firstOpen) {
    return "Все этапы, для которых заданы правила, сейчас выглядят завершёнными.";
  }

  return buildSingleStageReply(firstOpen);
}

export async function handleStageCheck(ctx = {}) {
  const ok = await requireMonarchAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const rawArg = String(rest || "").trim();
  if (!rawArg) {
    await bot.sendMessage(chatId, "Usage: /stage_check <stage|all|current>");
    return;
  }

  let workflowText;
  let rules;

  try {
    workflowText = loadWorkflowText();
    rules = loadRules();
  } catch (e) {
    await bot.sendMessage(chatId, `StageCheck error: ${e.message || "load_failed"}`);
    return;
  }

  const stages = parseWorkflowStages(workflowText);
  if (!stages.length) {
    await bot.sendMessage(chatId, "StageCheck error: no stages found in WORKFLOW.md");
    return;
  }

  const arg = normalizeStageKey(rawArg);

  const summaries = stages.map((stage) => summarizeStage(stage, rules));

  if (arg === "ALL") {
    await bot.sendMessage(chatId, buildAllStagesReply(summaries));
    return;
  }

  if (arg === "CURRENT") {
    await bot.sendMessage(chatId, buildCurrentStageReply(summaries));
    return;
  }

  const target = summaries.find((x) => x.key === arg);
  if (!target) {
    await bot.sendMessage(chatId, `StageCheck: unknown stage "${rawArg}"`);
    return;
  }

  await bot.sendMessage(chatId, buildSingleStageReply(target));
}

export default {
  handleStageCheck,
};