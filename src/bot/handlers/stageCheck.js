// ============================================================================
// === src/bot/handlers/stageCheck.js — READ-ONLY workflow tree checks (no AI)
// === UNIVERSAL MATCH-BASED VERSION (no hard binding to workflow item codes)
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

function extractStageHeading(line) {
  const match = String(line || "").match(/^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "stage",
  };
}

function extractSubHeading(line) {
  const match = String(line || "").match(/^##+\s+(.+)$/);
  if (!match) return null;

  const raw = String(match[1] || "").trim();

  const codeMatch =
    raw.match(/\b([0-9]+[A-Za-z]*(?:\.[A-Za-z0-9-]+)+)\b/) ||
    raw.match(/\b([0-9]+[A-Za-z]*)\b/);

  if (!codeMatch) return null;

  const code = normalizeItemCode(codeMatch[1]);
  const title = raw.replace(codeMatch[1], "").trim();

  return {
    code,
    title: title || raw,
    kind: "substage",
  };
}

function extractBulletItem(line) {
  const match = String(line || "").match(/^\s*-\s+([A-Za-z0-9.-]+)\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "point",
  };
}

function parseWorkflowItems(workflowText) {
  const lines = String(workflowText || "").replace(/\r/g, "").split("\n");

  const rawItems = [];
  const seenCodes = new Set();

  let insideWorkflow = false;
  let currentStageCode = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^## 4\)\s+WORKFLOW/i.test(line.trim())) {
      insideWorkflow = true;
      continue;
    }

    if (!insideWorkflow) continue;

    const stageHit = extractStageHeading(line);
    if (stageHit) {
      currentStageCode = stageHit.code;

      if (!seenCodes.has(stageHit.code)) {
        rawItems.push({
          ...stageHit,
          lineIndex: i,
          parentCode: null,
        });
        seenCodes.add(stageHit.code);
      }

      continue;
    }

    if (!currentStageCode) continue;

    const subHit = extractSubHeading(line);
    if (subHit && !seenCodes.has(subHit.code)) {
      rawItems.push({
        ...subHit,
        lineIndex: i,
        parentCode: getParentCode(subHit.code) || currentStageCode,
      });
      seenCodes.add(subHit.code);
      continue;
    }

    const bulletHit = extractBulletItem(line);
    if (bulletHit && !seenCodes.has(bulletHit.code)) {
      rawItems.push({
        ...bulletHit,
        lineIndex: i,
        parentCode: getParentCode(bulletHit.code) || currentStageCode,
      });
      seenCodes.add(bulletHit.code);
    }
  }

  const items = rawItems.map((item, idx) => {
    const nextLineIndex =
      idx + 1 < rawItems.length ? rawItems[idx + 1].lineIndex : lines.length;

    const body = lines.slice(item.lineIndex + 1, nextLineIndex).join("\n").trim();

    return {
      code: item.code,
      title: item.title,
      kind: item.kind,
      parentCode: item.parentCode,
      body,
      normalizedTitle: normalizeText(item.title),
      normalizedBody: normalizeText(body),
      normalizedText: normalizeText(`${item.title}\n${body}`),
    };
  });

  return items;
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
  return value.map((x) => normalizeText(x)).filter(Boolean);
}

function buildItemMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.code, item);
  }
  return map;
}

function getAncestorChain(item, itemMap) {
  const chain = [];
  let currentParentCode = item?.parentCode || null;

  while (currentParentCode) {
    const parent = itemMap.get(currentParentCode);
    if (!parent) break;

    chain.push(parent);
    currentParentCode = parent.parentCode || null;
  }

  return chain;
}

function tokensMatch(haystack, allTokens, anyTokens, noneTokens) {
  if (allTokens.length > 0 && !allTokens.every((t) => haystack.includes(t))) {
    return false;
  }

  if (anyTokens.length > 0 && !anyTokens.some((t) => haystack.includes(t))) {
    return false;
  }

  if (noneTokens.length > 0 && noneTokens.some((t) => haystack.includes(t))) {
    return false;
  }

  return allTokens.length > 0 || anyTokens.length > 0 || noneTokens.length > 0;
}

function ruleMatchesItem(rule, item, itemMap) {
  const targetKinds = Array.isArray(rule?.target_kinds)
    ? rule.target_kinds.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  if (targetKinds.length > 0 && !targetKinds.includes(String(item.kind || "").toLowerCase())) {
    return false;
  }

  const match = rule?.match || {};

  const itemAllTokens = toTokenList(match.all_tokens);
  const itemAnyTokens = toTokenList(match.any_tokens);
  const itemNoneTokens = toTokenList(match.none_tokens);

  const ancestorAllTokens = toTokenList(match.ancestor_all_tokens);
  const ancestorAnyTokens = toTokenList(match.ancestor_any_tokens);
  const ancestorNoneTokens = toTokenList(match.ancestor_none_tokens);

  const titleAllTokens = toTokenList(match.title_all_tokens);
  const titleAnyTokens = toTokenList(match.title_any_tokens);
  const titleNoneTokens = toTokenList(match.title_none_tokens);

  const bodyAllTokens = toTokenList(match.body_all_tokens);
  const bodyAnyTokens = toTokenList(match.body_any_tokens);
  const bodyNoneTokens = toTokenList(match.body_none_tokens);

  const itemHaystack = item.normalizedText || "";
  const titleHaystack = item.normalizedTitle || "";
  const bodyHaystack = item.normalizedBody || "";
  const ancestorHaystack = normalizeText(
    getAncestorChain(item, itemMap)
      .map((x) => `${x.title}\n${x.body}`)
      .join("\n")
  );

  if (
    (itemAllTokens.length > 0 || itemAnyTokens.length > 0 || itemNoneTokens.length > 0) &&
    !tokensMatch(itemHaystack, itemAllTokens, itemAnyTokens, itemNoneTokens)
  ) {
    return false;
  }

  if (
    (titleAllTokens.length > 0 || titleAnyTokens.length > 0 || titleNoneTokens.length > 0) &&
    !tokensMatch(titleHaystack, titleAllTokens, titleAnyTokens, titleNoneTokens)
  ) {
    return false;
  }

  if (
    (bodyAllTokens.length > 0 || bodyAnyTokens.length > 0 || bodyNoneTokens.length > 0) &&
    !tokensMatch(bodyHaystack, bodyAllTokens, bodyAnyTokens, bodyNoneTokens)
  ) {
    return false;
  }

  if (
    (ancestorAllTokens.length > 0 ||
      ancestorAnyTokens.length > 0 ||
      ancestorNoneTokens.length > 0) &&
    !tokensMatch(
      ancestorHaystack,
      ancestorAllTokens,
      ancestorAnyTokens,
      ancestorNoneTokens
    )
  ) {
    return false;
  }

  return true;
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

function evaluateSingleItem(item, rules, itemMap, fileSet) {
  const matchedRules = rules.filter((rule) => ruleMatchesItem(rule, item, itemMap));
  const checks = matchedRules.flatMap((rule) =>
    Array.isArray(rule?.checks) ? rule.checks : []
  );

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
    matchedRuleIds: matchedRules
      .map((x) => String(x?.id || "").trim())
      .filter(Boolean),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    status,
    results,
  };
}

function buildEvaluatedItems(workflowItems, rulesJson, fileSet) {
  const rules = Array.isArray(rulesJson?.rules) ? rulesJson.rules : [];
  const itemMap = buildItemMap(workflowItems);

  return workflowItems.map((item) =>
    evaluateSingleItem(item, rules, itemMap, fileSet)
  );
}

function getSubtreeItems(baseCode, evaluatedItems) {
  return evaluatedItems.filter((item) => isSameOrDescendant(baseCode, item.code));
}

function aggregateScope(scopeItems) {
  const configuredItems = scopeItems.filter((x) => x.totalChecks > 0);
  const noRulesItems = scopeItems.filter((x) => x.totalChecks === 0);
  const openItems = scopeItems.filter((x) => x.status === "OPEN");

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
      const rulesSuffix =
        Array.isArray(item.matchedRuleIds) && item.matchedRuleIds.length > 0
          ? ` rules:${item.matchedRuleIds.join(",")}`
          : "";

      lines.push(
        `- ${item.code} — ${item.status} — ${item.passedChecks}/${item.totalChecks}${rulesSuffix}`
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
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);
  const evaluatedItems = buildEvaluatedItems(workflowItems, rulesJson, fileSet);

  const topLevelStages = workflowItems.filter((item) => item.kind === "stage");

  const coverageMode =
    String(rulesJson?.coverage || "").trim() || "workflow_tree_match_rules";

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
