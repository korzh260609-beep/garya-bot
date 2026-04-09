// ============================================================================
// === src/bot/handlers/stageCheck.js — READ-ONLY universal stage checks (no AI)
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

const WORKFLOW_PATH = "pillars/WORKFLOW.md";
const RULES_PATH = "pillars/STAGE_CHECK_RULES.json";

function normalizeStageId(value) {
  return String(value || "")
    .trim()
    .replace(/^stage\s+/i, "")
    .toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMode(rest) {
  const token = String(rest || "")
    .trim()
    .split(/\s+/)[0];

  const normalized = normalizeStageId(token);

  if (!normalized) return { mode: "current", value: "current" };
  if (normalized === "ALL") return { mode: "all", value: "all" };
  if (normalized === "CURRENT") return { mode: "current", value: "current" };

  return { mode: "stage", value: normalized };
}

function parseWorkflowStages(workflowText) {
  const text = String(workflowText || "").replace(/\r/g, "");
  const lines = text.split("\n");

  const stages = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/);

    if (match) {
      if (current) {
        current.body = current.bodyLines.join("\n").trim();
        current.normalizedText = normalizeText(
          `${current.title}\n${current.body}`
        );
        delete current.bodyLines;
        stages.push(current);
      }

      current = {
        stage: normalizeStageId(match[1]),
        title: String(match[2] || "").trim(),
        bodyLines: [],
      };

      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    }
  }

  if (current) {
    current.body = current.bodyLines.join("\n").trim();
    current.normalizedText = normalizeText(`${current.title}\n${current.body}`);
    delete current.bodyLines;
    stages.push(current);
  }

  return stages;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch {
    return null;
  }
}

function toTokenList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

function ruleMatchesStage(rule, stage) {
  const match = rule?.match || {};
  const haystack = stage?.normalizedText || "";

  const allTokens = toTokenList(match.all_tokens);
  const anyTokens = toTokenList(match.any_tokens);
  const noneTokens = toTokenList(match.none_tokens);

  if (allTokens.length > 0 && !allTokens.every((t) => haystack.includes(t))) {
    return false;
  }

  if (anyTokens.length > 0 && !anyTokens.some((t) => haystack.includes(t))) {
    return false;
  }

  if (noneTokens.length > 0 && noneTokens.some((t) => haystack.includes(t))) {
    return false;
  }

  return allTokens.length > 0 || anyTokens.length > 0;
}

function formatCheckLabel(rule) {
  const label = String(rule?.label || "").trim();
  if (label) return label;

  if (rule?.type === "file_exists") return String(rule?.path || "").trim();

  if (rule?.type === "all_files_exist" || rule?.type === "any_file_exists") {
    return (Array.isArray(rule?.paths) ? rule.paths : []).join(", ");
  }

  return "unnamed_check";
}

function evaluateRule(rule, fileSet) {
  const type = String(rule?.type || "").trim();

  if (type === "file_exists") {
    const path = String(rule?.path || "").trim();
    const ok = !!path && fileSet.has(path);

    return {
      ok,
      type,
      label: formatCheckLabel(rule),
      details: path || "missing_path",
    };
  }

  if (type === "all_files_exist") {
    const paths = Array.isArray(rule?.paths)
      ? rule.paths.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    const missing = paths.filter((p) => !fileSet.has(p));
    const ok = paths.length > 0 && missing.length === 0;

    return {
      ok,
      type,
      label: formatCheckLabel(rule),
      details: ok ? "all_present" : `missing: ${missing.join(", ")}`,
    };
  }

  if (type === "any_file_exists") {
    const paths = Array.isArray(rule?.paths)
      ? rule.paths.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    const found = paths.filter((p) => fileSet.has(p));
    const ok = found.length > 0;

    return {
      ok,
      type,
      label: formatCheckLabel(rule),
      details: ok
        ? `found: ${found.join(", ")}`
        : `none_found: ${paths.join(", ")}`,
    };
  }

  return {
    ok: false,
    type: type || "unknown",
    label: formatCheckLabel(rule),
    details: "unsupported_rule_type",
  };
}

function evaluateStageWithRules(stage, matchedRules, fileSet) {
  const checks = matchedRules.flatMap((rule) =>
    Array.isArray(rule?.checks) ? rule.checks : []
  );

  const results = checks.map((rule) => evaluateRule(rule, fileSet));
  const passed = results.filter((x) => x.ok).length;
  const failed = results.filter((x) => !x.ok).length;

  const hasChecks = checks.length > 0;
  const hasRuleMatch = matchedRules.length > 0;
  const complete = hasChecks && failed === 0;

  let status = "OPEN";
  if (!hasRuleMatch) status = "NO_GENERIC_CHECKS";
  else if (!hasChecks) status = "NO_GENERIC_CHECKS";
  else if (complete) status = "COMPLETE";

  return {
    stage: stage.stage,
    workflowTitle: stage.title,
    matchedRuleIds: matchedRules.map((x) => String(x.id || "").trim()).filter(Boolean),
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed,
    complete,
    status,
    results,
  };
}

function buildEvaluatedStages(workflowStages, rulesJson, fileSet) {
  const genericRules = Array.isArray(rulesJson?.rules) ? rulesJson.rules : [];

  return workflowStages.map((stage) => {
    const matchedRules = genericRules.filter((rule) =>
      ruleMatchesStage(rule, stage)
    );

    return evaluateStageWithRules(stage, matchedRules, fileSet);
  });
}

function findCurrentOpenStage(items) {
  for (const item of items) {
    if (!item.complete) return item;
  }
  return null;
}

function formatSingleStageOutput(item, coverageMode) {
  const lines = [];

  lines.push(`stage_check: ${item.stage}`);
  lines.push(`workflow: ${item.workflowTitle || "(title_not_found)"}`);
  lines.push(`status: ${item.status}`);
  lines.push(`checks: ${item.passedChecks}/${item.totalChecks}`);
  lines.push(`coverage: ${coverageMode}`);

  if (item.matchedRuleIds.length > 0) {
    lines.push(`rules: ${item.matchedRuleIds.join(", ")}`);
  }

  if (item.status === "NO_GENERIC_CHECKS") {
    lines.push("note: no generic rules matched this workflow section");
    return lines.join("\n");
  }

  if (!item.complete) {
    const failed = item.results.filter((x) => !x.ok).slice(0, 10);
    if (failed.length > 0) {
      lines.push("missing:");
      for (const entry of failed) {
        lines.push(`- ${entry.label}`);
      }
    }
  }

  return lines.join("\n");
}

function formatAllStagesOutput(items, coverageMode) {
  const lines = [];

  lines.push("stage_check: all");
  lines.push(`coverage: ${coverageMode}`);

  if (!items.length) {
    lines.push("workflow: no stages found");
    return lines.join("\n");
  }

  for (const item of items) {
    lines.push(`${item.stage} — ${item.status} — ${item.passedChecks}/${item.totalChecks}`);
  }

  return lines.join("\n");
}

function formatCurrentOutput(item, coverageMode) {
  const lines = [];

  lines.push("stage_check: current");
  lines.push(`coverage: ${coverageMode}`);

  if (!item) {
    lines.push("result: all stages complete");
    return lines.join("\n");
  }

  lines.push(`current: ${item.stage}`);
  lines.push(`title: ${item.workflowTitle || "(title_not_found)"}`);
  lines.push(`status: ${item.status}`);
  lines.push(`checks: ${item.passedChecks}/${item.totalChecks}`);

  if (item.matchedRuleIds.length > 0) {
    lines.push(`rules: ${item.matchedRuleIds.join(", ")}`);
  }

  return lines.join("\n");
}

export async function handleStageCheck(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => ctx.bot.sendMessage(ctx.chatId, String(text ?? ""));

  const source = new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const modeInfo = parseMode(ctx.rest);

  const [workflowFile, rulesFile, repoFiles] = await Promise.all([
    source.fetchTextFile(WORKFLOW_PATH),
    source.fetchTextFile(RULES_PATH),
    source.listFiles(),
  ]);

  if (!workflowFile?.content) {
    await reply(`stage_check error: cannot read ${WORKFLOW_PATH}`);
    return;
  }

  if (!rulesFile?.content) {
    await reply(`stage_check error: cannot read ${RULES_PATH}`);
    return;
  }

  const rulesJson = safeJsonParse(rulesFile.content);
  if (!rulesJson) {
    await reply(`stage_check error: invalid JSON in ${RULES_PATH}`);
    return;
  }

  const workflowStages = parseWorkflowStages(workflowFile.content);
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);
  const evaluatedStages = buildEvaluatedStages(workflowStages, rulesJson, fileSet);

  const coverageMode =
    String(rulesJson?.coverage || "").trim() || "generic_match_rules";

  if (modeInfo.mode === "all") {
    await reply(formatAllStagesOutput(evaluatedStages, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_all",
    });
    return;
  }

  if (modeInfo.mode === "current") {
    const current = findCurrentOpenStage(evaluatedStages);
    await reply(formatCurrentOutput(current, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_current",
    });
    return;
  }

  const stageId = modeInfo.value;
  const item = evaluatedStages.find((x) => x.stage === stageId);

  if (!item) {
    await reply(
      `stage_check: ${stageId}\nstatus: STAGE_NOT_FOUND_IN_WORKFLOW\ncoverage: ${coverageMode}`
    );
    return;
  }

  await reply(formatSingleStageOutput(item, coverageMode), {
    cmd: "/stage_check",
    handler: "stageCheck",
    event: "stage_check_single",
  });
}