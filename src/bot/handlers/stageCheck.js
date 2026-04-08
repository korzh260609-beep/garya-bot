// ============================================================================
// === src/bot/handlers/stageCheck.js — READ-ONLY stage checks (no AI)
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
  const stages = [];
  const re = /^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/gm;
  let match;

  while ((match = re.exec(String(workflowText || "")))) {
    stages.push({
      stage: normalizeStageId(match[1]),
      title: String(match[2] || "").trim(),
    });
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

function buildRulesMap(rulesJson) {
  const map = new Map();
  const stages = Array.isArray(rulesJson?.stages) ? rulesJson.stages : [];

  for (const item of stages) {
    const stage = normalizeStageId(item?.stage);
    if (!stage) continue;
    map.set(stage, item);
  }

  return map;
}

function buildWorkflowTitleMap(workflowStages) {
  const map = new Map();

  for (const item of workflowStages) {
    map.set(item.stage, item.title);
  }

  return map;
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
      details: ok ? `found: ${found.join(", ")}` : `none_found: ${paths.join(", ")}`,
    };
  }

  return {
    ok: false,
    type: type || "unknown",
    label: formatCheckLabel(rule),
    details: "unsupported_rule_type",
  };
}

function evaluateStage(stageRule, fileSet) {
  const checks = Array.isArray(stageRule?.checks) ? stageRule.checks : [];
  const results = checks.map((rule) => evaluateRule(rule, fileSet));
  const passed = results.filter((x) => x.ok).length;
  const failed = results.filter((x) => !x.ok);
  const complete = checks.length > 0 && failed.length === 0;

  return {
    stage: normalizeStageId(stageRule?.stage),
    title: String(stageRule?.title || "").trim(),
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed.length,
    complete,
    results,
  };
}

function findCurrentOpenStage(orderedStages) {
  for (const item of orderedStages) {
    if (!item.complete) return item;
  }
  return null;
}

function formatSingleStageOutput({
  stageId,
  workflowTitle,
  evaluation,
  coverageMode,
}) {
  const lines = [];

  lines.push(`stage_check: ${stageId}`);
  lines.push(`workflow: ${workflowTitle || "(title_not_found)"}`);
  lines.push(`status: ${evaluation.complete ? "COMPLETE" : "OPEN"}`);
  lines.push(`checks: ${evaluation.passedChecks}/${evaluation.totalChecks}`);
  lines.push(`coverage: ${coverageMode}`);

  if (!evaluation.complete) {
    const failed = evaluation.results.filter((x) => !x.ok).slice(0, 10);
    if (failed.length > 0) {
      lines.push("missing:");
      for (const item of failed) {
        lines.push(`- ${item.label}`);
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
    lines.push("rules: no stages configured");
    return lines.join("\n");
  }

  for (const item of items) {
    lines.push(
      `${item.stage} — ${item.complete ? "COMPLETE" : "OPEN"} — ${item.passedChecks}/${item.totalChecks}`
    );
  }

  return lines.join("\n");
}

function formatCurrentOutput(item, coverageMode) {
  const lines = [];
  lines.push("stage_check: current");
  lines.push(`coverage: ${coverageMode}`);

  if (!item) {
    lines.push("result: no open stage found inside rules coverage");
    return lines.join("\n");
  }

  lines.push(`current: ${item.stage}`);
  lines.push(`title: ${item.workflowTitle || "(title_not_found)"}`);
  lines.push(`checks: ${item.passedChecks}/${item.totalChecks}`);
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
  const workflowTitleMap = buildWorkflowTitleMap(workflowStages);
  const rulesMap = buildRulesMap(rulesJson);
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);

  const orderedRuleStages = workflowStages
    .filter((item) => rulesMap.has(item.stage))
    .map((item) => {
      const rule = rulesMap.get(item.stage);
      const evaluation = evaluateStage(rule, fileSet);

      return {
        stage: item.stage,
        workflowTitle: item.title,
        title: evaluation.title || item.title,
        totalChecks: evaluation.totalChecks,
        passedChecks: evaluation.passedChecks,
        failedChecks: evaluation.failedChecks,
        complete: evaluation.complete,
        results: evaluation.results,
      };
    });

  const coverageMode =
    String(rulesJson?.coverage || "").trim() || "partial_rules_only";

  if (modeInfo.mode === "all") {
    await reply(formatAllStagesOutput(orderedRuleStages, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_all",
    });
    return;
  }

  if (modeInfo.mode === "current") {
    const current = findCurrentOpenStage(orderedRuleStages);
    await reply(formatCurrentOutput(current, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_current",
    });
    return;
  }

  const stageId = modeInfo.value;
  const stageRule = rulesMap.get(stageId);

  if (!stageRule) {
    await reply(
      `stage_check: ${stageId}\nstatus: RULES_NOT_FOUND\ncoverage: ${coverageMode}`
    );
    return;
  }

  const evaluation = evaluateStage(stageRule, fileSet);
  const workflowTitle =
    workflowTitleMap.get(stageId) || String(stageRule?.title || "").trim();

  await reply(
    formatSingleStageOutput({
      stageId,
      workflowTitle,
      evaluation,
      coverageMode,
    }),
    {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_single",
    }
  );
}