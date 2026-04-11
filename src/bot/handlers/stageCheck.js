// ============================================================================
// === src/bot/handlers/stageCheck.js — handler only
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

import { safeJsonParse } from "./stage-check/common.js";
import {
  parseWorkflowItems,
  buildItemMap,
  getSubtreeItems,
} from "./stage-check/workflowParser.js";
import {
  buildConfig,
  hasAllowedExtension,
  sortSearchPaths,
  collectOwnSignals,
  collectInheritedSignals,
  buildAutoChecksForItem,
} from "./stage-check/signals.js";
import {
  safeFetchTextFile,
} from "./stage-check/repoUtils.js";
import {
  evaluateSingleItem,
  buildEvaluatedItems,
  aggregateScope,
} from "./stage-check/evaluator.js";
import {
  WORKFLOW_PATH,
  RULES_PATH,
  detectLanguageFromContext,
  parseMode,
  createTranslator,
  formatSingleItemOutput,
  formatAllStagesOutput,
  formatCurrentOutput,
  formatDiagOutput,
} from "./stage-check/formatters.js";

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
  }));

  return {
    explicitPaths,
    commands: own.commands.slice(0, 5),
    ownSignals: own.signals.slice(0, 8),
    inheritedSignals: inherited.slice(0, 8),
    checksCount: checks.length,
    checkResults,
    directFileReads,
    itemStatus: evaluated.status,
    passedChecks: evaluated.passedChecks,
    failedChecks: evaluated.failedChecks,
  };
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

export async function handleStageCheck(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => ctx.bot.sendMessage(ctx.chatId, String(text ?? ""));

  const lang = detectLanguageFromContext(ctx);
  const { t, humanStatus } = createTranslator({
    lang,
    workflowPath: WORKFLOW_PATH,
    rulesPath: RULES_PATH,
  });

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
    await reply(t("cannot_read_workflow"));
    return;
  }

  if (!rulesFile?.content) {
    await reply(t("cannot_read_rules"));
    return;
  }

  const rulesJson = safeJsonParse(rulesFile.content);
  if (!rulesJson) {
    await reply(t("invalid_rules"));
    return;
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
  const targetItem =
    modeInfo.mode === "item"
      ? workflowItems.find((x) => x.code === modeInfo.value) || null
      : null;

  if (modeInfo.diag) {
    const evaluationCtx = createEvaluationCtx({
      source,
      config,
      fileSet,
      searchableFiles,
      itemMap,
    });

    const itemDiag = targetItem
      ? await buildItemDiag(targetItem, evaluationCtx)
      : null;

    await reply(
      formatDiagOutput({
        modeInfo,
        source,
        repoFiles,
        searchableFiles,
        workflowItems,
        topLevelStages,
        evaluationCtx,
        targetItem,
        itemDiag,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_diag",
      }
    );
    return;
  }

  if (modeInfo.mode === "all") {
    const evaluationCtx = createEvaluationCtx({
      source,
      config,
      fileSet,
      searchableFiles,
      itemMap,
    });

    let evaluatedItems;
    try {
      evaluatedItems = await buildEvaluatedItems(workflowItems, evaluationCtx);
    } catch {
      await reply(t("runtime_failed"));
      return;
    }

    await reply(
      formatAllStagesOutput({
        topLevelItems: topLevelStages,
        evaluatedItems,
        t,
        humanStatus,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_all",
      }
    );
    return;
  }

  if (modeInfo.mode === "current") {
    const evaluationCtx = createEvaluationCtx({
      source,
      config,
      fileSet,
      searchableFiles,
      itemMap,
    });

    let evaluatedItems;
    try {
      evaluatedItems = await buildEvaluatedItems(workflowItems, evaluationCtx);
    } catch {
      await reply(t("runtime_failed"));
      return;
    }

    await reply(
      formatCurrentOutput({
        topLevelItems: topLevelStages,
        evaluatedItems,
        t,
        humanStatus,
      }),
      {
        cmd: "/stage_check",
        handler: "stageCheck",
        event: "stage_check_current",
      }
    );
    return;
  }

  const itemCode = modeInfo.value;
  const baseItem = workflowItems.find((x) => x.code === itemCode);

  if (!baseItem) {
    await reply(
      `${t("header_single", { code: itemCode })}\n${t("status")}: ${t("item_not_found")}`
    );
    return;
  }

  const scopeWorkflowItems = getSubtreeItems(itemCode, workflowItems);
  const evaluationCtx = createEvaluationCtx({
    source,
    config,
    fileSet,
    searchableFiles,
    itemMap,
  });

  let scopeItems;
  try {
    scopeItems = await buildEvaluatedItems(scopeWorkflowItems, evaluationCtx);
  } catch {
    await reply(t("runtime_failed"));
    return;
  }

  const aggregate = aggregateScope(scopeItems);

  await reply(
    formatSingleItemOutput({
      baseItem,
      scopeItems,
      aggregate,
      t,
      humanStatus,
    }),
    {
      cmd: "/stage_check",
      handler: "stageCheck",
      event: "stage_check_single",
    }
  );
}