// ============================================================================
// === src/bot/handlers/stage-check/evaluator.js
// ============================================================================

import { buildAutoChecksForItem } from "./signals.js";
import {
  findBasenameInRepo,
  searchTokenInRepo,
  findStructuredIndexInMigrations,
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
    };
  }

  if (check.type === "structured_index_exists") {
    const searchResult = await findStructuredIndexInMigrations(check, ctx);

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || "structured_index_exists",
      details: searchResult.details,
    };
  }

  return {
    ok: false,
    type: String(check.type || "unknown"),
    label: String(check.label || "unsupported_check"),
    details: "unsupported_check_type",
  };
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

  const structuredEntries = entries.filter(
    (entry) => entry.check?.type === "structured_index_exists"
  );
  const hasStructuredChecks = structuredEntries.length > 0;
  const hasPassedStructuredCheck = structuredEntries.some((entry) => entry.result?.ok);

  let status = "NO_SIGNALS";

  if (autoChecks.length === 0) {
    status = "NO_SIGNALS";
  } else if (hasStructuredChecks) {
    status = hasPassedStructuredCheck ? "COMPLETE" : "OPEN";
  } else if (failedChecks === 0) {
    status = "COMPLETE";
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

export function aggregateScope(scopeItems) {
  const configuredItems = scopeItems.filter((x) => x.totalChecks > 0);
  const openItems = scopeItems.filter((x) => x.status === "OPEN");
  const noSignalItems = scopeItems.filter((x) => x.status === "NO_SIGNALS");

  let status = "NO_SIGNALS";
  if (openItems.length > 0) status = "OPEN";
  else if (configuredItems.length > 0) status = "COMPLETE";

  const passedEntries = [];
  const failedEntries = [];

  for (const item of scopeItems) {
    item.results.forEach((result, index) => {
      const entry = {
        code: item.code,
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
    configuredItems: configuredItems.length,
    noSignalItems: noSignalItems.length,
    totalChecks: scopeItems.reduce((sum, x) => sum + x.totalChecks, 0),
    passedChecks: scopeItems.reduce((sum, x) => sum + x.passedChecks, 0),
    failedChecks: scopeItems.reduce((sum, x) => sum + x.failedChecks, 0),
    status,
    passedEntries,
    failedEntries,
  };
}