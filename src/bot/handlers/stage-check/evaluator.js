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
import {
  determineSemanticTypeFromChecks,
  isModuleLikeTitle,
} from "./semantics.js";

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
      evidenceClass: check.evidenceClass || "explicit_file",
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
      evidenceClass: check.evidenceClass || "basename_anchor",
    };
  }

  if (check.type === "text_exists") {
    const token = String(check.token || "").trim();
    const searchResult = await searchTokenInRepo(token, ctx);

    const evidenceClass = check.evidenceClass || "semantic_support";
    const strength =
      !searchResult.ok
        ? "none"
        : evidenceClass === "generic_support" || evidenceClass === "command_surface"
          ? "weak"
          : evidenceClass === "signature_anchor" ||
              evidenceClass === "carrier_anchor" ||
              evidenceClass === "function_name"
            ? "strong"
            : "weak";

    return {
      ok: searchResult.ok,
      type: check.type,
      label: check.label || token || "text_exists",
      details: searchResult.details,
      strength,
      evidenceClass,
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
      evidenceClass: check.evidenceClass || "structured_anchor",
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
      evidenceClass: check.evidenceClass || "cluster_anchor",
    };
  }

  return {
    ok: false,
    type: String(check.type || "unknown"),
    label: String(check.label || "unsupported_check"),
    details: "unsupported_check_type",
    strength: "none",
    evidenceClass: check.evidenceClass || "unknown",
  };
}

function isExplicitStrongCheckType(type) {
  return (
    type === "file_exists" ||
    type === "basename_exists" ||
    type === "structured_index_exists"
  );
}

function countBy(entries, predicate) {
  return entries.filter(predicate).length;
}

function parseFoundPath(details) {
  const text = String(details || "").trim();
  if (!text) return "";

  const foundIn = text.match(/^found_in:\s+(.+)$/i);
  if (foundIn) return String(foundIn[1] || "").trim();

  const foundAs = text.match(/^found_as:\s+(.+)$/i);
  if (foundAs) return String(foundAs[1] || "").trim();

  const structuredIn = text.match(/^structured_match_in:\s+(.+?)(?:\s+@.+)?$/i);
  if (structuredIn) return String(structuredIn[1] || "").trim();

  return "";
}

function isSelfCheckerPath(path) {
  const value = String(path || "").toLowerCase();
  return value.startsWith("src/bot/handlers/stage-check/");
}

function hasExplicitAnchor(entries) {
  return entries.some(
    (entry) =>
      entry.result?.ok &&
      (
        isExplicitStrongCheckType(entry.check?.type) ||
        entry.result?.evidenceClass === "basename_anchor" ||
        entry.result?.evidenceClass === "explicit_file" ||
        entry.result?.evidenceClass === "structured_anchor"
      )
  );
}

function countSupportingEvidence(entries) {
  return countBy(
    entries,
    (entry) =>
      entry.result?.ok &&
      entry.result?.evidenceClass !== "generic_support" &&
      entry.result?.evidenceClass !== "command_surface" &&
      entry.result?.evidenceClass !== "cluster_anchor"
  );
}

function countGenericOnlyEvidence(entries) {
  return countBy(
    entries,
    (entry) =>
      entry.result?.ok &&
      (
        entry.result?.evidenceClass === "generic_support" ||
        entry.result?.evidenceClass === "command_surface"
      )
  );
}

function hasSignatureAnchor(entries) {
  return entries.some(
    (entry) =>
      entry.result?.ok &&
      (
        entry.result?.evidenceClass === "signature_anchor" ||
        entry.result?.evidenceClass === "basename_anchor" ||
        entry.result?.evidenceClass === "explicit_file"
      )
  );
}

function hasCarrierAnchor(entries) {
  return entries.some(
    (entry) =>
      entry.result?.ok &&
      (
        entry.result?.evidenceClass === "carrier_anchor" ||
        entry.result?.evidenceClass === "basename_anchor" ||
        entry.result?.evidenceClass === "explicit_file"
      )
  );
}

function countRealMethodEvidence(entries) {
  return countBy(
    entries,
    (entry) =>
      entry.result?.ok &&
      (
        entry.result?.evidenceClass === "signature_anchor" ||
        entry.result?.evidenceClass === "function_name" ||
        entry.result?.evidenceClass === "carrier_anchor" ||
        entry.result?.evidenceClass === "basename_anchor" ||
        entry.result?.evidenceClass === "explicit_file"
      )
  );
}

function getOkEntriesByEvidenceClass(entries, allowedClasses) {
  return entries.filter(
    (entry) =>
      entry.result?.ok &&
      allowedClasses.has(String(entry.result?.evidenceClass || ""))
  );
}

function hasIndependentCorroboration(entries) {
  const signatureEntries = getOkEntriesByEvidenceClass(
    entries,
    new Set(["signature_anchor"])
  );

  if (signatureEntries.length === 0) return false;

  const corroboratingEntries = getOkEntriesByEvidenceClass(
    entries,
    new Set(["explicit_file", "basename_anchor", "function_name"])
  );

  if (corroboratingEntries.length === 0) return false;

  const signaturePaths = new Set(
    signatureEntries
      .map((entry) => parseFoundPath(entry.result?.details))
      .filter(Boolean)
  );

  if (signaturePaths.size === 0) {
    return corroboratingEntries.length > 0;
  }

  for (const entry of corroboratingEntries) {
    const path = parseFoundPath(entry.result?.details);
    if (!path) return true;
    if (!signaturePaths.has(path)) return true;
    if (entry.result?.evidenceClass !== "signature_anchor") return true;
  }

  return false;
}

function getCarrierAnchorPaths(entries) {
  const carrierEntries = getOkEntriesByEvidenceClass(
    entries,
    new Set(["carrier_anchor", "basename_anchor", "explicit_file"])
  );

  return new Set(
    carrierEntries
      .map((entry) => parseFoundPath(entry.result?.details))
      .filter((path) => path && !isSelfCheckerPath(path))
  );
}

function countLocalInterfaceMethodEvidence(entries) {
  const carrierPaths = getCarrierAnchorPaths(entries);
  if (carrierPaths.size === 0) return 0;

  let count = 0;

  for (const entry of entries) {
    if (!entry.result?.ok) continue;

    const evidenceClass = String(entry.result?.evidenceClass || "");
    if (
      evidenceClass !== "signature_anchor" &&
      evidenceClass !== "function_name" &&
      evidenceClass !== "basename_anchor" &&
      evidenceClass !== "explicit_file"
    ) {
      continue;
    }

    const path = parseFoundPath(entry.result?.details);
    if (!path) continue;
    if (isSelfCheckerPath(path)) continue;

    if (carrierPaths.has(path)) {
      count += 1;
    }
  }

  return count;
}

function isPolicyLikeSemanticType(semanticType) {
  return semanticType === "policy_like";
}

function isArchitectureLikeSemanticType(semanticType) {
  return semanticType === "architecture_like";
}

function isExecutableSemanticType(semanticType) {
  return semanticType === "signature_like" || semanticType === "interface_like";
}

function isFoundationRuntimeLikeSemanticType(semanticType) {
  return semanticType === "foundation_runtime_like";
}

function getRootScopeItem(scopeItems) {
  return (
    scopeItems.find(
      (item) => !scopeItems.some((other) => other.code === item.parentCode)
    ) || scopeItems[0] || null
  );
}

function hasDescendantsInScope(item, scopeItems) {
  return scopeItems.some(
    (other) => other.code !== item.code && other.code.startsWith(`${item.code}.`)
  );
}

function getLeafScopeItems(scopeItems) {
  return scopeItems.filter((item) => !hasDescendantsInScope(item, scopeItems));
}

function isModuleLikeStage(rootItem, scopeItems) {
  if (!rootItem || rootItem.kind !== "stage") return false;
  if (isModuleLikeTitle(rootItem.title)) return true;

  const leafItems = getLeafScopeItems(scopeItems).filter((x) => x.totalChecks > 0);
  if (leafItems.length === 0) return false;

  const policyLeaves = leafItems.filter((x) => isPolicyLikeSemanticType(x.semanticType)).length;
  const executableLeaves = leafItems.filter((x) => isExecutableSemanticType(x.semanticType)).length;
  const architectureLeaves = leafItems.filter((x) => isArchitectureLikeSemanticType(x.semanticType)).length;

  if (policyLeaves > 0 && executableLeaves > 0) return true;
  if (executableLeaves >= 2) return true;
  if (architectureLeaves > 0 && executableLeaves > 0) return true;

  return false;
}

function hasStrongExplicitImplementationEvidence(item) {
  return (item.results || []).some(
    (result) =>
      result?.ok &&
      (
        result?.evidenceClass === "explicit_file" ||
        result?.evidenceClass === "basename_anchor" ||
        result?.evidenceClass === "structured_anchor" ||
        result?.evidenceClass === "signature_anchor" ||
        result?.evidenceClass === "carrier_anchor" ||
        result?.evidenceClass === "function_name"
      )
  );
}

function hasNonPolicySupportingEvidence(item) {
  return (item.results || []).some(
    (result) =>
      result?.ok &&
      result?.evidenceClass !== "generic_support" &&
      result?.evidenceClass !== "command_surface"
  );
}

function contributesToCapabilityAggregation(item) {
  const semanticType = String(item?.semanticType || "generic");
  const positive = item?.status === "COMPLETE" || item?.status === "PARTIAL";
  if (!positive) return false;

  if (isPolicyLikeSemanticType(semanticType)) return false;
  if (isArchitectureLikeSemanticType(semanticType)) return false;

  if (isExecutableSemanticType(semanticType)) {
    return hasStrongExplicitImplementationEvidence(item);
  }

  if (isFoundationRuntimeLikeSemanticType(semanticType)) {
    return hasNonPolicySupportingEvidence(item);
  }

  if (semanticType === "generic") {
    return (
      hasStrongExplicitImplementationEvidence(item) &&
      hasNonPolicySupportingEvidence(item)
    );
  }

  return false;
}

function hasImplementationPositiveLeaf(configuredLeafItems) {
  return configuredLeafItems.some((item) => contributesToCapabilityAggregation(item));
}

function hasPolicyPositiveLeaf(configuredLeafItems) {
  return configuredLeafItems.some(
    (item) =>
      isPolicyLikeSemanticType(item.semanticType) &&
      (item.status === "COMPLETE" || item.status === "PARTIAL")
  );
}

function buildAggregationFlags(item, entries) {
  return {
    hasStrongExplicitImplementationEvidence: hasStrongExplicitImplementationEvidence(item),
    hasNonPolicySupportingEvidence: hasNonPolicySupportingEvidence(item),
    contributesToCapabilityAggregation: contributesToCapabilityAggregation(item),
    okEvidenceClasses: entries
      .filter((entry) => entry.result?.ok)
      .map((entry) => String(entry.result?.evidenceClass || "")),
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

  const hasPassedExplicitStrong = explicitStrongEntries.some((entry) => entry.result?.ok);

  const hasPassedStrongCluster = clusterEntries.some(
    (entry) => entry.result?.ok && entry.result?.strength === "strong"
  );

  const hasPassedWeakCheck = weakEntries.some((entry) => entry.result?.ok);

  const semanticInfo = determineSemanticTypeFromChecks(item, autoChecks);
  const semanticType = semanticInfo.semanticType || "generic";

  const explicitAnchor = hasExplicitAnchor(entries);
  const supportingEvidence = countSupportingEvidence(entries);
  const genericOnlyEvidence = countGenericOnlyEvidence(entries);

  let status = "NO_SIGNALS";

  if (autoChecks.length === 0) {
    status = "NO_SIGNALS";
  } else if (semanticType === "signature_like") {
    const hasExactSignatureHit = entries.some(
      (entry) =>
        entry.result?.ok &&
        entry.result?.evidenceClass === "signature_anchor"
    );

    const independentCorroboration = hasIndependentCorroboration(entries);
    const signatureAnchor = hasSignatureAnchor(entries);
    const realMethodEvidence = countRealMethodEvidence(entries);

    if (hasExactSignatureHit && independentCorroboration) {
      status = "COMPLETE";
    } else if (signatureAnchor && (independentCorroboration || realMethodEvidence >= 2)) {
      status = "PARTIAL";
    } else if (realMethodEvidence >= 2) {
      status = "PARTIAL";
    } else {
      status = "OPEN";
    }
  } else if (semanticType === "interface_like") {
    const carrierAnchor = hasCarrierAnchor(entries);
    const localMethodEvidence = countLocalInterfaceMethodEvidence(entries);

    if (carrierAnchor && localMethodEvidence >= 3) {
      status = "COMPLETE";
    } else if ((carrierAnchor && localMethodEvidence >= 1) || localMethodEvidence >= 3) {
      status = "PARTIAL";
    } else {
      status = "OPEN";
    }
  } else if (semanticType === "architecture_like") {
    if (hasPassedExplicitStrong && supportingEvidence >= 2) {
      status = "COMPLETE";
    } else if (explicitAnchor && supportingEvidence >= 1) {
      status = "PARTIAL";
    } else {
      status = "OPEN";
    }
  } else if (semanticType === "policy_like") {
    if (hasPassedExplicitStrong && supportingEvidence >= 2) {
      status = "COMPLETE";
    } else if (explicitAnchor && supportingEvidence >= 1) {
      status = "PARTIAL";
    } else {
      status = "OPEN";
    }
  } else if (semanticType === "foundation_runtime_like") {
    const nonPolicyCorroboration =
      supportingEvidence >= 2 ||
      (supportingEvidence >= 1 && hasPassedStrongCluster);

    const denseDistributedEvidence =
      supportingEvidence >= 3 ||
      (supportingEvidence >= 2 && hasPassedWeakCheck) ||
      (hasPassedStrongCluster && supportingEvidence >= 2);

    if (
      (hasPassedExplicitStrong && nonPolicyCorroboration) ||
      (hasPassedStrongCluster && denseDistributedEvidence) ||
      (supportingEvidence >= 4)
    ) {
      status = "COMPLETE";
    } else if (
      explicitAnchor ||
      hasPassedStrongCluster ||
      supportingEvidence >= 2 ||
      (supportingEvidence >= 1 && hasPassedWeakCheck)
    ) {
      status = "PARTIAL";
    } else {
      status = "OPEN";
    }
  } else if (hasPassedExplicitStrong && supportingEvidence >= 2) {
    status = "COMPLETE";
  } else if (hasPassedExplicitStrong) {
    status = "PARTIAL";
  } else if (explicitAnchor && supportingEvidence >= 1) {
    status = "PARTIAL";
  } else if (hasPassedStrongCluster && supportingEvidence >= 1) {
    status = "PARTIAL";
  } else if (autoChecks.length > 0) {
    status = explicitAnchor && hasPassedWeakCheck ? "PARTIAL" : "OPEN";
  } else if (genericOnlyEvidence > 0) {
    status = "OPEN";
  } else {
    status = "OPEN";
  }

  const evaluatedItem = {
    code: item.code,
    title: item.title,
    kind: item.kind,
    parentCode: item.parentCode,
    totalChecks: autoChecks.length,
    passedChecks,
    failedChecks,
    status,
    semanticType,
    checks: autoChecks,
    results,
  };

  return {
    ...evaluatedItem,
    aggregationFlags: buildAggregationFlags(evaluatedItem, entries),
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
  const leafItems = getLeafScopeItems(scopeItems);
  const configuredLeafItems = leafItems.filter((x) => x.totalChecks > 0);

  const completeItems = configuredLeafItems.filter((x) => x.status === "COMPLETE");
  const partialItems = configuredLeafItems.filter((x) => x.status === "PARTIAL");
  const openItems = configuredLeafItems.filter((x) => x.status === "OPEN");
  const noSignalItems = leafItems.filter((x) => x.status === "NO_SIGNALS");

  const totalChecks = leafItems.reduce((sum, x) => sum + x.totalChecks, 0);
  const passedChecks = leafItems.reduce((sum, x) => sum + x.passedChecks, 0);
  const failedChecks = leafItems.reduce((sum, x) => sum + x.failedChecks, 0);

  const rootItem = getRootScopeItem(scopeItems);
  const moduleLikeStage = isModuleLikeStage(rootItem, scopeItems);

  const implementationPositiveLeaf = hasImplementationPositiveLeaf(configuredLeafItems);
  const policyPositiveLeaf = hasPolicyPositiveLeaf(configuredLeafItems);

  const positiveOnlyFromPolicy =
    policyPositiveLeaf && !implementationPositiveLeaf;

  let status = "NO_SIGNALS";
  if (configuredLeafItems.length === 0) {
    status = "NO_SIGNALS";
  } else if (moduleLikeStage && !implementationPositiveLeaf) {
    status = "OPEN";
  } else if (moduleLikeStage && positiveOnlyFromPolicy) {
    status = "OPEN";
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
        semanticType: item.semanticType || "generic",
        aggregationFlags: item.aggregationFlags || {},
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
    aggregationDebug: {
      rootCode: rootItem?.code || null,
      rootKind: rootItem?.kind || null,
      rootTitle: rootItem?.title || null,
      moduleLikeStage,
      implementationPositiveLeaf,
      policyPositiveLeaf,
      positiveOnlyFromPolicy,
      positiveLeafs: configuredLeafItems
        .filter((item) => item.status === "COMPLETE" || item.status === "PARTIAL")
        .map((item) => ({
          code: item.code,
          status: item.status,
          semanticType: item.semanticType || "generic",
          contributesToCapabilityAggregation:
            !!item?.aggregationFlags?.contributesToCapabilityAggregation,
          hasStrongExplicitImplementationEvidence:
            !!item?.aggregationFlags?.hasStrongExplicitImplementationEvidence,
          hasNonPolicySupportingEvidence:
            !!item?.aggregationFlags?.hasNonPolicySupportingEvidence,
        })),
    },
  };
}