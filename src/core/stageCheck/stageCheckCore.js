// ============================================================================
// === src/core/stageCheck/stageCheckCore.js
// === platform-agnostic core for workflow stage checking
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";

import { safeJsonParse } from "../../bot/handlers/stage-check/common.js";
import {
  parseWorkflowItems,
  buildItemMap,
  getSubtreeItems,
} from "../../bot/handlers/stage-check/workflowParser.js";
import {
  buildConfig,
  hasAllowedExtension,
  sortSearchPaths,
  collectOwnSignals,
  collectInheritedSignals,
  buildAutoChecksForItem,
} from "../../bot/handlers/stage-check/signals.js";
import { safeFetchTextFile } from "../../bot/handlers/stage-check/repoUtils.js";
import {
  evaluateSingleItem,
  buildEvaluatedItems,
  aggregateScope,
} from "../../bot/handlers/stage-check/evaluator.js";
import {
  WORKFLOW_PATH,
  RULES_PATH,
} from "../../bot/handlers/stage-check/formatters.js";

function createRepoSource() {
  return new RepoSource({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });
}

function createEvaluationCtx({
  source,
  config,
  fileSet,
  searchableFiles,
  itemMap,
}) {
  return {
    source,
    config,
    fileSet,
    searchableFiles,
    contentCache: new Map(),
    searchCache: new Map(),
    structuredCache: new Map(),
    fetchStats: { used: 0 },
    errorStats: { fetchFailures: 0 },
    itemMap,
  };
}

async function buildItemDiag(item, evaluationCtx) {
  const own = collectOwnSignals(item, evaluationCtx.config);
  const inherited = collectInheritedSignals(
    item,
    evaluationCtx.itemMap,
    evaluationCtx.config
  );
  const checks = buildAutoChecksForItem(
    item,
    evaluationCtx.itemMap,
    evaluationCtx.config
  );
  const evaluated = await evaluateSingleItem(item, evaluationCtx);

  const explicitPaths = own.explicitPaths.slice(0, 5);
  const directFileReads = [];

  for (const path of explicitPaths.slice(0, 3)) {
    const content = await safeFetchTextFile(path, evaluationCtx);
    directFileReads.push({
      path,
      readable: typeof content === "string" && content.length > 0,
    });
  }

  const checkResults = checks.slice(0, 12).map((check, index) => ({
    type: check?.type || "unknown",
    label: check?.label || "-",
    ok: !!evaluated.results[index]?.ok,
    details: evaluated.results[index]?.details || "-",
    evidenceClass: evaluated.results[index]?.evidenceClass || "-",
    strength: evaluated.results[index]?.strength || "-",
  }));

  const subtreeWorkflowItems = getSubtreeItems(item.code, Array.from(evaluationCtx.itemMap.values()));
  const scopeItems = await buildEvaluatedItems(subtreeWorkflowItems, evaluationCtx);
  const scopeAggregate = aggregateScope(scopeItems);

  return {
    explicitPaths,
    commands: own.commands.slice(0, 5),
    ownSignals: own.signals.slice(0, 8),
    inheritedSignals: inherited.slice(0, 8),
    checksCount: checks.length,
    checkResults,
    directFileReads,
    itemStatus: evaluated.status,
    itemSemanticType: evaluated.semanticType,
    itemAggregationFlags: evaluated.aggregationFlags || {},
    passedChecks: evaluated.passedChecks,
    failedChecks: evaluated.failedChecks,
    scopeAggregateStatus: scopeAggregate.status,
    scopeAggregationDebug: scopeAggregate.aggregationDebug || null,
  };
}

async function loadStageCheckEnvironment() {
  const source = createRepoSource();

  const [workflowFile, rulesFile, repoFiles] = await Promise.all([
    source.fetchTextFile(WORKFLOW_PATH),
    source.fetchTextFile(RULES_PATH),
    source.listFiles(),
  ]);

  if (!workflowFile?.content) {
    return {
      ok: false,
      errorCode: "cannot_read_workflow",
      source,
      workflowFile: null,
      rulesFile,
      repoFiles,
    };
  }

  if (!rulesFile?.content) {
    return {
      ok: false,
      errorCode: "cannot_read_rules",
      source,
      workflowFile,
      rulesFile: null,
      repoFiles,
    };
  }

  const rulesJson = safeJsonParse(rulesFile.content);
  if (!rulesJson) {
    return {
      ok: false,
      errorCode: "invalid_rules",
      source,
      workflowFile,
      rulesFile,
      repoFiles,
    };
  }

  const config = buildConfig(rulesJson);
  const workflowItems = parseWorkflowItems(workflowFile.content);
  const itemMap = buildItemMap(workflowItems);
  const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles : []);
  const searchableFiles = sortSearchPaths(
    Array.from(fileSet).filter((p) => hasAllowedExtension(p, config)),
    config
  );
  const topLevelStages = workflowItems.filter((item) => item.kind === "stage");

  return {
    ok: true,
    source,
    workflowFile,
    rulesFile,
    repoFiles,
    rulesJson,
    config,
    workflowItems,
    itemMap,
    fileSet,
    searchableFiles,
    topLevelStages,
  };
}

export async function runStageCheckCore({
  modeInfo,
} = {}) {
  const env = await loadStageCheckEnvironment();
  if (!env.ok) {
    return env;
  }

  const {
    source,
    repoFiles,
    config,
    workflowItems,
    itemMap,
    fileSet,
    searchableFiles,
    topLevelStages,
  } = env;

  const evaluationCtx = createEvaluationCtx({
    source,
    config,
    fileSet,
    searchableFiles,
    itemMap,
  });

  const targetItem =
    modeInfo?.mode === "item"
      ? workflowItems.find((x) => x.code === modeInfo.value) || null
      : null;

  if (modeInfo?.diag) {
    const itemDiag = targetItem
      ? await buildItemDiag(targetItem, evaluationCtx)
      : null;

    return {
      ok: true,
      kind: "diag",
      modeInfo,
      source,
      repoFiles,
      searchableFiles,
      workflowItems,
      topLevelStages,
      evaluationCtx,
      targetItem,
      itemDiag,
    };
  }

  if (modeInfo?.mode === "all") {
    try {
      const evaluatedItems = await buildEvaluatedItems(workflowItems, evaluationCtx);

      return {
        ok: true,
        kind: "all",
        modeInfo,
        topLevelStages,
        evaluatedItems,
      };
    } catch {
      return {
        ok: false,
        errorCode: "runtime_failed",
      };
    }
  }

  if (modeInfo?.mode === "current") {
    try {
      const evaluatedItems = await buildEvaluatedItems(workflowItems, evaluationCtx);

      return {
        ok: true,
        kind: "current",
        modeInfo,
        topLevelStages,
        evaluatedItems,
      };
    } catch {
      return {
        ok: false,
        errorCode: "runtime_failed",
      };
    }
  }

  const itemCode = modeInfo?.value || "";
  const baseItem = workflowItems.find((x) => x.code === itemCode) || null;

  if (!baseItem) {
    return {
      ok: false,
      errorCode: "item_not_found",
      itemCode,
    };
  }

  const scopeWorkflowItems = getSubtreeItems(itemCode, workflowItems);

  try {
    const scopeItems = await buildEvaluatedItems(scopeWorkflowItems, evaluationCtx);
    const aggregate = aggregateScope(scopeItems);

    return {
      ok: true,
      kind: "single",
      modeInfo,
      itemCode,
      baseItem,
      scopeItems,
      aggregate,
    };
  } catch {
    return {
      ok: false,
      errorCode: "runtime_failed",
    };
  }
}

export default {
  runStageCheckCore,
};