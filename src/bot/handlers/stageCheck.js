// ============================================================================
// === src/bot/handlers/stageCheck.js — READ-ONLY workflow item checks (no AI)
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

const WORKFLOW_PATH = "pillars/WORKFLOW.md";
const RULES_PATH = "pillars/STAGE_CHECK_RULES.json";

function normalizeItemCode(value) {
  return String(value || "")
    .trim()
    .replace(/^stage\s+/i, "")
    .toUpperCase();
}

function parseMode(rest) {
  const token = String(rest || "")
    .trim()
    .split(/\s+/)[0];

  const normalized = normalizeItemCode(token);

  if (!normalized) return { mode: "current", value: "current" };
  if (normalized === "ALL") return { mode: "all", value: "all" };
  if (normalized === "CURRENT") return { mode: "current", value: "current" };

  return { mode: "item", value: normalized };
}

function getParentCode(code) {
  const value = normalizeItemCode(code);
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  return value.slice(0, lastDot);
}

function isSameOrDescendant(baseCode, candidateCode) {
  const base = normalizeItemCode(baseCode);
  const candidate = normalizeItemCode(candidateCode);

  return candidate === base || candidate.startsWith(`${base}.`);
}

function extractCodeFromStageHeading(line) {
  const match = String(line || "").match(/^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "stage",
  };
}

function extractCodeFromSubHeading(line) {
  const match = String(line || "").match(/^##+\s+(.+)$/);
  if (!match) return null;

  const raw = String(match[1] || "").trim();

  const codeMatch =
    raw.match(/\b([0-9]+[A-Za-z]*(?:\.[A-Za-z0-9-]+)+)\b/) ||
    raw.match(/\b([0-9]+[A-Za-z]*)\b/);

  if (!codeMatch) return null;

  const code = normalizeItemCode(codeMatch[1]);
  const title = raw.replace(codeMatch[1], "").replace(/\(\s*\)/g, "").trim();

  return {
    code,
    title: title || raw,
    kind: "substage",
  };
}

function extractCodeFromBullet(line) {
  const match = String(line || "").match(/^\s*-\s+([A-Za-z0-9.-]+)\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "point",
  };
}

function parseWorkflowItems(workflowText) {
  const text = String(workflowText || "").replace(/\r/g, "");
  const lines = text.split("\n");

  const items = [];
  const seen = new Set();

  let insideRoadmap = false;
  let currentStageCode = null;

  for (const line of lines) {
    if (/^## 4\)\s+WORKFLOW/i.test(line.trim())) {
      insideRoadmap = true;
      continue;
    }

    if (!insideRoadmap) continue;

    const stageHit = extractCodeFromStageHeading(line);
    if (stageHit) {
      currentStageCode = stageHit.code;

      if (!seen.has(stageHit.code)) {
        items.push({
          code: stageHit.code,
          title: stageHit.title,
          kind: stageHit.kind,
          parentCode: null,
        });
        seen.add(stageHit.code);
      }

      continue;
    }

    if (!currentStageCode) continue;

    const subHit = extractCodeFromSubHeading(line);
    if (subHit && !seen.has(subHit.code)) {
      items.push({
        code: subHit.code,
        title: subHit.title,
        kind: subHit.kind,
        parentCode: getParentCode(subHit.code) || currentStageCode,
      });
      seen.add(subHit.code);
      continue;
    }

    const bulletHit = extractCodeFromBullet(line);
    if (bulletHit && !seen.has(bulletHit.code)) {
      items.push({
        code: bulletHit.code,
        title: bulletHit.title,
        kind: bulletHit.kind,
        parentCode: getParentCode(bulletHit.code) || currentStageCode,
      });
      seen.add(bulletHit.code);
    }
  }

  return items;
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
  const items = Array.isArray(rulesJson?.items) ? rulesJson.items : [];

  for (const item of items) {
    const code = normalizeItemCode(item?.code);
    if (!code) continue;
    map.set(code, item);
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

function evaluateSingleItem(item, rulesMap, fileSet) {
  const ruleEntry = rulesMap.get(item.code);
  const checks = Array.isArray(ruleEntry?.checks) ? ruleEntry.checks : [];
  const results = checks.map((rule) => evaluateRule(rule, fileSet));

  const passedChecks = results.filter((x) => x.ok).length;
  const failedChecks = results.filter((x) => !x.ok).length;
  const hasChecks = checks.length > 0;

  let status = "NO_RULES";
  if (hasChecks && failedChecks === 0) status = "COMPLETE";
  else if (hasChecks) status = "OPEN";

  return {
    code: item.code,
    title: item.title,
    kind: item.kind,
    parentCode: item.parentCode,
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    status,
    results,
  };
}

function buildEvaluatedItems(workflowItems, rulesMap, fileSet) {
  return workflowItems.map((item) => evaluateSingleItem(item, rulesMap, fileSet));
}

function getSubtreeItems(baseCode, evaluatedItems) {
  return evaluatedItems.filter((item) => isSameOrDescendant(baseCode, item.code));
}

function aggregateScope(scopeItems) {
  const configuredItems = scopeItems.filter((x) => x.totalChecks > 0);
  const noRulesItems = scopeItems.filter((x) => x.totalChecks === 0);
  const openItems = scopeItems.filter((x) => x.status === "OPEN");
  const completeItems = scopeItems.filter((x) => x.status === "COMPLETE");

  let status = "NO_RULES";
  if (openItems.length > 0) status = "OPEN";
  else if (configuredItems.length === 0) status = "NO_RULES";
  else if (noRulesItems.length > 0) status = "PARTIAL_RULES";
  else status = "COMPLETE";

  const failedEntries = [];
  for (const item of scopeItems) {
    for (const result of item.results) {
      if (!result.ok) {
        failedEntries.push({
          code: item.code,
          label: result.label,
        });
      }
    }
  }

  return {
    totalItems: scopeItems.length,
    configuredItems: configuredItems.length,
    noRulesItems: noRulesItems.length,
    openItems: openItems.length,
    completeItems: completeItems.length,
    totalChecks: scopeItems.reduce((sum, x) => sum + x.totalChecks, 0),
    passedChecks: scopeItems.reduce((sum, x) => sum + x.passedChecks, 0),
    failedChecks: scopeItems.reduce((sum, x) => sum + x.failedChecks, 0),
    status,
    failedEntries,
  };
}

function formatSingleItemOutput(baseItem, scopeItems, aggregate, coverageMode) {
  const lines = [];

  lines.push(`stage_check: ${baseItem.code}`);
  lines.push(`workflow: ${baseItem.title || "(title_not_found)"}`);
  lines.push(`status: ${aggregate.status}`);
  lines.push(`scope_items: ${aggregate.totalItems}`);
  lines.push(`configured_items: ${aggregate.configuredItems}`);
  lines.push(`checks: ${aggregate.passedChecks}/${aggregate.totalChecks}`);
  lines.push(`coverage: ${coverageMode}`);

  if (aggregate.noRulesItems > 0) {
    lines.push(`no_rules_items: ${aggregate.noRulesItems}`);
  }

  if (aggregate.failedEntries.length > 0) {
    lines.push("missing:");
    for (const entry of aggregate.failedEntries.slice(0, 10)) {
      lines.push(`- ${entry.code} → ${entry.label}`);
    }
  }

  if (scopeItems.length > 1) {
    lines.push("scope:");
    for (const item of scopeItems.slice(0, 20)) {
      lines.push(
        `- ${item.code} — ${item.status} — ${item.passedChecks}/${item.totalChecks}`
      );
    }
  }

  return lines.join("\n");
}

function formatAllStagesOutput(topLevelItems, evaluatedItems, coverageMode) {
  const lines = [];

  lines.push("stage_check: all");
  lines.push(`coverage: ${coverageMode}`);

  if (!topLevelItems.length) {
    lines.push("workflow: no stages found");
    return lines.join("\n");
  }

  for (const stage of topLevelItems) {
    const scopeItems = getSubtreeItems(stage.code, evaluatedItems);
    const aggregate = aggregateScope(scopeItems);

    lines.push(
      `${stage.code} — ${aggregate.status} — ${aggregate.passedChecks}/${aggregate.totalChecks} — items:${aggregate.totalItems}`
    );
  }

  return lines.join("\n");
}

function formatCurrentOutput(topLevelItems, evaluatedItems, coverageMode) {
  const lines = [];

  lines.push("stage_check: current");
  lines.push(`coverage: ${coverageMode}`);

  for (const stage of topLevelItems) {
    const scopeItems = getSubtreeItems(stage.code, evaluatedItems);
    const aggregate = aggregateScope(scopeItems);

    if (aggregate.status !== "COMPLETE") {
      lines.push(`current: ${stage.code}`);
      lines.push(`title: ${stage.title || "(title_not_found)"}`);
      lines.push(`status: ${aggregate.status}`);
      lines.push(`scope_items: ${aggregate.totalItems}`);
      lines.push(`checks: ${aggregate.passedChecks}/${aggregate.totalChecks}`);
      return lines.join("\n");
    }
  }

  lines.push("result: all top-level stages complete");
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

  const workflowItems = parseWorkflowItems(workflowFile.content);
  const rulesMap = buildRulesMap(rulesJson);
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);
  const evaluatedItems = buildEvaluatedItems(workflowItems, rulesMap, fileSet);

  const topLevelStages = workflowItems.filter((item) => item.kind === "stage");

  const coverageMode =
    String(rulesJson?.coverage || "").trim() || "workflow_tree_item_rules";

  if (modeInfo.mode === "all") {
    await reply(formatAllStagesOutput(topLevelStages, evaluatedItems, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_all",
    });
    return;
  }

  if (modeInfo.mode === "current") {
    await reply(formatCurrentOutput(topLevelStages, evaluatedItems, coverageMode), {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_current",
    });
    return;
  }

  const itemCode = modeInfo.value;
  const baseItem = workflowItems.find((x) => x.code === itemCode);

  if (!baseItem) {
    await reply(
      `stage_check: ${itemCode}\nstatus: ITEM_NOT_FOUND_IN_WORKFLOW\ncoverage: ${coverageMode}`
    );
    return;
  }

  const scopeItems = getSubtreeItems(itemCode, evaluatedItems);
  const aggregate = aggregateScope(scopeItems);

  await reply(
    formatSingleItemOutput(baseItem, scopeItems, aggregate, coverageMode),
    {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_single",
    }
  );
}