// ============================================================================
// === src/bot/handlers/stage-check/evaluator.js
// ============================================================================

import { buildAutoChecksForItem } from "./signals.js";
import {
  findBasenameInRepo,
  searchTokenInRepo,
  findStructuredIndexInMigrations,
  findSignalClusterInRepo,
} from "./repoUtils.js";

export async function evaluateCheck(check, ctx) {
  if (check.type === "file_exists") {
    const path = String(check.path || "").trim();
    const ok = !!path && ctx.fileSet.has(path);

    return {
      ok,
      type: check.type,
      label: check.label || path || "file_exists",
      details: path || "missing_path",
      strength: ok ? "strong" : "none",
    };
  }

  if (check.type === "basename_exists") {
    const basename = String(check.basename || "").trim();
    const foundPath = findBasenameInRepo(basename, ctx.fileSet);
    const ok = !!foundPath;

    return {
      ok,
      type: check.type,
      label: check.label || basename || "basename_exists",
      details: ok ? `found_as: ${foundPath}` : "basename_not_found",
      strength: ok ? "strong" : "none",
    };
  }

  if (check.type === "text_exists") {
    const token = String(check.token || "").trim();
    const searchResult = await searchTokenInRepo(token, ctx);

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || token || "text_exists",
      details: searchResult.details,
      strength: searchResult.ok ? "weak" : "none",
    };
  }

  if (check.type === "structured_index_exists") {
    const searchResult = await findStructuredIndexInMigrations(check, ctx);

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || "structured_index_exists",
      details: searchResult.details,
      strength: searchResult.ok ? "strong" : "none",
    };
  }

  if (check.type === "signal_cluster_exists") {
    const searchResult = await findSignalClusterInRepo(check, ctx);

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || "signal_cluster_exists",
      details: searchResult.details,
      strength: searchResult.ok ? searchResult.strength || "weak" : "none",
      matchedTokens: searchResult.matchedTokens ?? 0,
      distinctFiles: searchResult.distinctFiles ?? 0,
    };
  }

  return {
    ok: false,
    type: String(check.type || "unknown"),
    label: String(check.label || "unsupported_check"),
    details: "unsupported_check_type",
    strength: "none",
  };
}

function isExplicitStrongCheckType(type) {
  return (
    type === "file_exists" ||
    type === "basename_exists" ||
    type === "structured_index_exists"
  );
}

export async function evaluateSingleItem(item, ctx) {
  const autoChecks = buildAutoChecksForItem(item, ctx.itemMap, ctx.config);

  const results = [];
  for (const check of autoChecks) {
    results.push(await evaluateCheck(check, ctx));
  }

  const entries = autoChecks.map((check, index) => ({
    check,
    result: results[index],
  }));

  const passedChecks = results.filter((x) => x.ok).length;
  const failedChecks = results.filter((x) => !x.ok).length;

  const explicitStrongEntries = entries.filter((entry) =>
    isExplicitStrongCheckType(entry.check?.type)
  );
  const clusterEntries = entries.filter(
    (entry) => entry.check?.type === "signal_cluster_exists"
  );
  const weakEntries = entries.filter(
    (entry) =>
      !isExplicitStrongCheckType(entry.check?.type) &&
      entry.check?.type !== "signal_cluster_exists"
  );

  const hasExplicitStrongChecks = explicitStrongEntries.length > 0;
  const hasPassedExplicitStrong = explicitStrongEntries.some((entry) => entry.result?.ok);

  const hasClusterChecks = clusterEntries.length > 0;
  const hasPassedStrongCluster = clusterEntries.some(
    (entry) => entry.result?.ok && entry.result?.strength === "strong"
  );
  const hasPassedWeakCluster = clusterEntries.some(
    (entry) => entry.result?.ok && entry.result?.strength === "weak"
  );

  const hasPassedWeakCheck = weakEntries.some((entry) => entry.result?.ok);

  let status = "NO_SIGNALS";

  if (autoChecks.length === 0) {
    status = "NO_SIGNALS";
  } else if (hasPassedExplicitStrong || hasPassedStrongCluster) {
    status = "COMPLETE";
  } else if (hasExplicitStrongChecks || hasClusterChecks) {
    status = hasPassedWeakCluster || hasPassedWeakCheck ? "PARTIAL" : "OPEN";
  } else if (failedChecks === 0) {
    status = "COMPLETE";
  } else if (passedChecks > 0) {
    status = "PARTIAL";
  } else {
    status = "OPEN";
  }

  return {
    code: item.code,
    title: item.title,
    kind: item.kind,
    parentCode: item.parentCode,
    totalChecks: autoChecks.length,
    passedChecks,
    failedChecks,
    status,
    checks: autoChecks,
    results,
  };
}

export async function buildEvaluatedItems(workflowItems, ctx) {
  const output = [];
  for (const item of workflowItems) {
    output.push(await evaluateSingleItem(item, ctx));
  }
  return output;
}

function hasDescendantsInScope(item, scopeItems) {
  return scopeItems.some(
    (other) => other.code !== item.code && other.code.startsWith(`${item.code}.`)
  );
}

function getLeafScopeItems(scopeItems) {
  return scopeItems.filter((item) => !hasDescendantsInScope(item, scopeItems));
}

export function aggregateScope(scopeItems) {
  const leafItems = getLeafScopeItems(scopeItems);
  const configuredLeafItems = leafItems.filter((x) => x.totalChecks > 0);

  const completeItems = configuredLeafItems.filter((x) => x.status === "COMPLETE");
  const partialItems = configuredLeafItems.filter((x) => x.status === "PARTIAL");
  const openItems = configuredLeafItems.filter((x) => x.status === "OPEN");
  const noSignalItems = leafItems.filter((x) => x.status === "NO_SIGNALS");

  const totalChecks = leafItems.reduce((sum, x) => sum + x.totalChecks, 0);
  const passedChecks = leafItems.reduce((sum, x) => sum + x.passedChecks, 0);
  const failedChecks = leafItems.reduce((sum, x) => sum + x.failedChecks, 0);

  let status = "NO_SIGNALS";
  if (configuredLeafItems.length === 0) {
    status = "NO_SIGNALS";
  } else if (
    completeItems.length === configuredLeafItems.length &&
    partialItems.length === 0 &&
    openItems.length === 0
  ) {
    status = "COMPLETE";
  } else if (completeItems.length > 0 || partialItems.length > 0) {
    status = "PARTIAL";
  } else {
    status = "OPEN";
  }

  const passedEntries = [];
  const failedEntries = [];

  for (const item of leafItems) {
    item.results.forEach((result, index) => {
      const entry = {
        code: item.code,
        title: item.title,
        kind: item.kind,
        status: item.status,
        details: result.details,
        type: result.type,
        check: item.checks[index],
      };

      if (result.ok) passedEntries.push(entry);
      else failedEntries.push(entry);
    });
  }

  return {
    totalItems: scopeItems.length,
    leafItemsCount: leafItems.length,
    childItemsCount: leafItems.length,
    configuredItems: configuredLeafItems.length,
    configuredChildItems: configuredLeafItems.length,
    configuredLeafItems: configuredLeafItems.length,
    completeItems: completeItems.length,
    partialItems: partialItems.length,
    openItems: openItems.length,
    noSignalItems: noSignalItems.length,
    totalChecks,
    passedChecks,
    failedChecks,
    status,
    passedEntries,
    failedEntries,
  };
}
