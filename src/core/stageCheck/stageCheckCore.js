// ============================================================================
// === src/core/stageCheck/stageCheckCore.js
// === platform-agnostic core for workflow stage checking (dual-status)
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

import { runFormalReview } from "./formal/formalReviewService.js";
import { buildSubtreeItemRealReviews } from "./real/realItemReviewService.js";
import { buildAggregatedRealReview } from "./real/realAggregateEvaluator.js";
import { evaluateStatusGap } from "./gap/statusGapEvaluator.js";

import { buildScopeSemanticProfile } from "./real/realScopeProfile.js";
import { resolveProfileDraft } from "./real/profileSkeleton/profileResolverDraft.js";

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

function buildDraftProfileDiagnostics(scopeWorkflowItems = []) {
  const scopeSemanticProfile = buildScopeSemanticProfile(scopeWorkflowItems);
  const draft = resolveProfileDraft({
    scopeWorkflowItems,
    scopeSemanticProfile,
  });

  return {
    profileKey: draft?.profileKey || "generic.default",
    family: draft?.family || "generic",
    score: Number(draft?.score || 0),
    semanticTags: Array.isArray(scopeSemanticProfile?.tags)
      ? scopeSemanticProfile.tags
      : [],
  };
}

function buildDualReviewObject({
  baseItem,
  scopeWorkflowItems,
  formalResult,
  realReview,
  gapReview,
  itemRealReviews = [],
  techDiag = null,
  draftProfileDiag = null,
} = {}) {
  return {
    item: {
      code: baseItem?.code || "",
      title: baseItem?.title || "",
      kind: baseItem?.kind || "",
      parentCode: baseItem?.parentCode || null,
      scopeSize: Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems.length : 0,
    },
    formal: formalResult?.review || null,
    real: realReview || null,
    gap: gapReview || null,
    scopeItems: formalResult?.scopeItems || [],
    aggregate: formalResult?.aggregate || null,
    itemRealReviews: Array.isArray(itemRealReviews) ? itemRealReviews : [],
    techDiag,
    draftProfileDiag,
  };
}

async function buildSingleDualReview({
  baseItem,
  scopeWorkflowItems,
  evaluationCtx,
  includeTechDiag = false,
  includeDraftProfileDiag = false,
} = {}) {
  const formalResult = await runFormalReview({
    scopeWorkflowItems,
    evaluationCtx,
  });

  const itemRealReviews = await buildSubtreeItemRealReviews({
    scopeWorkflowItems,
    evaluationCtx,
  });

  const realReview = buildAggregatedRealReview({
    baseItem,
    scopeWorkflowItems,
    itemRealReviews,
  });

  const gapReview = evaluateStatusGap({
    formalReview: formalResult.review,
    realReview,
  });

  const techDiag = includeTechDiag
    ? await buildItemDiag(baseItem, evaluationCtx)
    : null;

  const draftProfileDiag = includeDraftProfileDiag
    ? buildDraftProfileDiagnostics(scopeWorkflowItems)
    : null;

  return buildDualReviewObject({
    baseItem,
    scopeWorkflowItems,
    formalResult,
    realReview,
    gapReview,
    itemRealReviews,
    techDiag,
    draftProfileDiag,
  });
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

  const subtreeWorkflowItems = getSubtreeItems(
    item.code,
    Array.from(evaluationCtx.itemMap.values())
  );
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

async function buildStageReviews({
  topLevelStages,
  workflowItems,
  evaluationCtx,
  includeTechDiag = false,
  includeDraftProfileDiag = false,
}) {
  const stageReviews = [];

  for (const stage of topLevelStages) {
    const scopeWorkflowItems = getSubtreeItems(stage.code, workflowItems);
    const review = await buildSingleDualReview({
      baseItem: stage,
      scopeWorkflowItems,
      evaluationCtx,
      includeTechDiag,
      includeDraftProfileDiag,
    });

    stageReviews.push(review);
  }

  return stageReviews;
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

  const includeTechDiag = modeInfo?.diag === true;
  const includeDraftProfileDiag = modeInfo?.diag === true;

  const targetItem =
    modeInfo?.mode === "item"
      ? workflowItems.find((x) => x.code === modeInfo.value) || null
      : null;

  if (modeInfo?.mode === "all") {
    try {
      const stageReviews = await buildStageReviews({
        topLevelStages,
        workflowItems,
        evaluationCtx,
        includeTechDiag,
        includeDraftProfileDiag,
      });

      return {
        ok: true,
        kind: "all",
        modeInfo,
        topLevelStages,
        stageReviews,
        source,
        repoFiles,
        searchableFiles,
        workflowItems,
        evaluationCtx,
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
      const stageReviews = await buildStageReviews({
        topLevelStages,
        workflowItems,
        evaluationCtx,
        includeTechDiag,
        includeDraftProfileDiag,
      });

      return {
        ok: true,
        kind: "current",
        modeInfo,
        topLevelStages,
        stageReviews,
        source,
        repoFiles,
        searchableFiles,
        workflowItems,
        evaluationCtx,
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
    const review = await buildSingleDualReview({
      baseItem,
      scopeWorkflowItems,
      evaluationCtx,
      includeTechDiag,
      includeDraftProfileDiag,
    });

    return {
      ok: true,
      kind: "single",
      modeInfo,
      itemCode,
      baseItem,
      review,
      source,
      repoFiles,
      searchableFiles,
      workflowItems,
      evaluationCtx,
      targetItem,
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