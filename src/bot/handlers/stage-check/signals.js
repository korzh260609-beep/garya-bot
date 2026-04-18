// ============================================================================
// === src/bot/handlers/stage-check/signals.js
// ============================================================================

import { uniq } from "./common.js";
import {
  buildConfig,
  hasAllowedExtension,
  sortSearchPaths,
} from "./config.js";
import {
  isUsefulToken,
  isWeakGenericToken,
  isWeakInheritedToken,
  isStrongTechnicalToken,
  isPascalCaseToken,
} from "./classification.js";
import {
  buildConceptualVariants,
  buildPhraseSemanticSignals,
} from "./morphology.js";
import {
  extractExplicitPaths,
  extractCommands,
  extractBackticked,
  extractSlashListItems,
  extractIdentifiers,
  extractDefinitionUsageSignals,
} from "./extractors.js";
import { buildStructuredChecksForItem } from "./structuredChecks.js";
import { buildClusterCheck } from "./cluster.js";
import { getAncestorChain } from "./workflowParser.js";
import {
  classifyWorkflowItemSemantics,
  isLikelyRealFunctionToken,
  sanitizeFunctionLikeTokens,
} from "./semantics.js";

export function canGenerateBasenameFromSignal(token, config) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return false;
  if (!isPascalCaseToken(raw)) return false;
  if (config.basenameBlocklist.has(lower)) return false;

  const hasKnownSuffix = config.basenameSignalSuffixes.some((suffix) =>
    raw.endsWith(suffix)
  );

  if (hasKnownSuffix) return true;

  if (!config.allowPascalCaseBasenameSignals) return false;
  if (raw.length < config.minPascalCaseBasenameLength) return false;

  return true;
}

export function buildCandidateBasenamesFromToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return [];

  return uniq([
    `${raw}.js`,
    `${raw}.mjs`,
    `${raw}.cjs`,
    `${raw}.ts`,
    `${raw}.mts`,
    `${raw}.cts`,
  ]);
}

export function collectOwnSignals(item, config) {
  const ownText = `${item.title}\n${item.body || ""}`;
  const ownPaths = extractExplicitPaths(ownText);
  const ownCommands = extractCommands(ownText);
  const ownBackticked = extractBackticked(ownText);
  const ownSlashList = extractSlashListItems(ownText);
  const ownIdentifiers = extractIdentifiers(ownText, config);
  const ownPhraseSignals = buildPhraseSemanticSignals(ownText, config);
  const ownDefinitionSignals = extractDefinitionUsageSignals(ownText, config);
  const semantics = classifyWorkflowItemSemantics(item);

  const ownBacktickPaths = ownBackticked.filter((x) => x.includes("/") && x.includes("."));
  const ownBacktickCommands = ownBackticked.filter((x) => x.startsWith("/"));
  const ownBacktickIdentifiers = ownBackticked.filter(
    (x) => !x.startsWith("/") && !(x.includes("/") && x.includes("."))
  );

  const expandedBackticks = [];
  for (const token of ownBacktickIdentifiers) {
    expandedBackticks.push(...buildConceptualVariants(token, config));
  }

  let signals = uniq([
    ...ownIdentifiers,
    ...ownSlashList,
    ...expandedBackticks,
    ...ownPhraseSignals,
    ...ownDefinitionSignals,
  ]).filter((token) => isUsefulToken(token, config));

  // policy-like points may keep text signals,
  // but function-like garbage must never leak into implementation hints
  if (semantics.isPolicyLike) {
    signals = signals.filter((token) => {
      const raw = String(token || "").trim();
      if (!raw) return false;
      if (isLikelyRealFunctionToken(raw) && raw.includes("(")) return false;
      return true;
    });
  }

  return {
    explicitPaths: uniq([...ownPaths, ...ownBacktickPaths]),
    commands: uniq([...ownCommands, ...ownBacktickCommands.map((x) => x.toLowerCase())]),
    signals,
    semantics,
  };
}

export function collectInheritedSignals(item, itemMap, config) {
  const ancestorSignals = [];
  const ancestors = getAncestorChain(item, itemMap);

  for (const parent of ancestors) {
    const parentText = `${parent.title}\n${parent.body || ""}`;
    const tokens = uniq([
      ...extractIdentifiers(parentText, config),
      ...extractBackticked(parentText),
      ...extractSlashListItems(parentText),
      ...buildPhraseSemanticSignals(parentText, config),
      ...extractDefinitionUsageSignals(parentText, config),
    ]);

    for (const token of tokens) {
      for (const variant of buildConceptualVariants(token, config)) {
        if (!isUsefulToken(variant, config)) continue;
        if (isWeakInheritedToken(variant) && !isStrongTechnicalToken(variant)) continue;

        if (canGenerateBasenameFromSignal(variant, config) || isUsefulToken(variant, config)) {
          ancestorSignals.push(variant);
        }
      }
    }
  }

  return uniq(ancestorSignals).slice(0, config.maxInheritedSignals);
}

function buildFunctionContractChecks(item, own, inheritedSignals) {
  const checks = [];
  const semantics = own.semantics || {
    semanticType: "generic",
    functionTokens: [],
  };

  const fnTokens = sanitizeFunctionLikeTokens(semantics.functionTokens || []);
  const seen = new Set();

  function push(check) {
    const key = JSON.stringify(check);
    if (seen.has(key)) return;
    seen.add(key);
    checks.push(check);
  }

  // universal hard guard:
  // policy / architecture points must never generate implementation checks
  if (
    semantics.semanticType === "policy_like" ||
    semantics.semanticType === "architecture_like"
  ) {
    return checks;
  }

  if (semantics.semanticType === "signature_like") {
    for (const token of fnTokens) {
      const raw = String(token || "").trim();
      if (!raw) continue;

      if (/^[A-Za-z_][A-Za-z0-9_]*\($/.test(raw)) {
        push({
          type: "text_exists",
          token: raw,
          label: `function call token: ${raw}`,
          evidenceClass: "signature_anchor",
        });
        continue;
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/.test(raw)) {
        push({
          type: "text_exists",
          token: raw,
          label: `function signature token: ${raw}`,
          evidenceClass: "signature_anchor",
        });
        continue;
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
        push({
          type: "text_exists",
          token: raw,
          label: `function token: ${raw}`,
          evidenceClass: isWeakGenericToken(raw) ? "generic_support" : "function_name",
        });

        push({
          type: "text_exists",
          token: `${raw}(`,
          label: `function call token: ${raw}(`,
          evidenceClass: "signature_anchor",
        });
      }
    }
  }

  if (semantics.semanticType === "interface_like") {
    const mergedSignals = uniq([...(own.signals || []), ...(inheritedSignals || [])]);

    for (const token of mergedSignals) {
      const raw = String(token || "").trim();
      if (!raw) continue;

      const lower = raw.toLowerCase();

      if (
        lower === "memoryservice" ||
        lower === "jobrunner"
      ) {
        push({
          type: "text_exists",
          token: raw,
          label: `contract carrier token: ${raw}`,
          evidenceClass: "carrier_anchor",
        });
      }
    }
  }

  return checks;
}

function hasSignalFragment(tokens, fragments) {
  const list = Array.isArray(tokens) ? tokens : [];
  const probes = Array.isArray(fragments) ? fragments : [];

  return list.some((token) => {
    const lower = String(token || "").toLowerCase();
    if (!lower) return false;
    return probes.some((fragment) => lower.includes(String(fragment || "").toLowerCase()));
  });
}

function buildFoundationRuntimeChecks(item, own, inheritedSignals) {
  const checks = [];
  const semantics = own.semantics || {
    semanticType: "generic",
  };

  if (semantics.semanticType !== "foundation_runtime_like") {
    return checks;
  }

  const mergedSignals = uniq([...(own.signals || []), ...(inheritedSignals || [])]);
  const text = `${item.title}\n${item.body || ""}`.toLowerCase();
  const tokens = uniq([
    ...mergedSignals,
    ...text.split(/\s+/).map((x) => String(x || "").trim()).filter(Boolean),
  ]);

  const seen = new Set();

  function push(check) {
    const key = JSON.stringify(check);
    if (seen.has(key)) return;
    seen.add(key);
    checks.push(check);
  }

  function pushFile(path, label = null) {
    push({
      type: "file_exists",
      path,
      label: label || `runtime foundation file: ${path}`,
      evidenceClass: "explicit_file",
    });
  }

  function pushBasename(basename, label = null) {
    push({
      type: "basename_exists",
      basename,
      label: label || `runtime foundation basename: ${basename}`,
      evidenceClass: "basename_anchor",
    });
  }

  function pushText(token, label = null, evidenceClass = "semantic_support") {
    push({
      type: "text_exists",
      token,
      label: label || `runtime foundation token: ${token}`,
      evidenceClass,
    });
  }

  const hasRuntimeConcept =
    hasSignalFragment(tokens, [
      "runtime",
      "bootstrap",
      "entrypoint",
      "server",
      "http",
      "node",
      "express",
      "render",
      "webhook",
      "transport",
      "adapter",
      "reply",
      "respond",
      "message",
      "bot",
    ]);

  const hasTransportConcept =
    hasSignalFragment(tokens, [
      "transport",
      "adapter",
      "webhook",
      "message",
      "reply",
      "respond",
      "bot",
      "telegram",
    ]);

  const hasTelegramConcept =
    hasSignalFragment(tokens, [
      "telegram",
      "telegrambot",
      "node-telegram-bot-api",
      "tg",
    ]);

  const hasReplyConcept =
    hasSignalFragment(tokens, [
      "reply",
      "respond",
      "send message",
      "sendmessage",
      "message flow",
      "bot reply",
    ]);

  const hasWebhookConcept =
    hasSignalFragment(tokens, [
      "webhook",
      "process update",
      "processupdate",
      "incoming message",
      "outgoing message",
      "update",
    ]);

  if (hasRuntimeConcept) {
    pushFile("package.json");
    pushFile("index.js");
    pushText("express", "runtime foundation token: express", "semantic_support");
    pushText("createApp(", "runtime bootstrap token: createApp(", "signature_anchor");
  }

  if (hasTransportConcept) {
    pushBasename("telegramTransport.js");
    pushBasename("TelegramAdapter.js");
    pushText("handleMessage(", "transport handoff token: handleMessage(", "signature_anchor");
    pushText("reply(", "transport reply token: reply(", "signature_anchor");
  }

  if (hasTelegramConcept) {
    pushText("node-telegram-bot-api", "telegram dependency token: node-telegram-bot-api", "carrier_anchor");
    pushText("TelegramBot", "telegram carrier token: TelegramBot", "carrier_anchor");
    pushText("TelegramAdapter", "telegram adapter token: TelegramAdapter", "carrier_anchor");
    pushText("initTelegramTransport", "telegram bootstrap token: initTelegramTransport", "function_name");
    pushText("telegramTransport", "telegram transport token: telegramTransport", "carrier_anchor");
  }

  if (hasWebhookConcept) {
    pushText("setWebhook", "webhook token: setWebhook", "function_name");
    pushText("setWebHook", "webhook token: setWebHook", "function_name");
    pushText("processUpdate", "update processing token: processUpdate", "function_name");
  }

  if (hasReplyConcept || hasTransportConcept || hasTelegramConcept) {
    pushText("sendMessage(", "reply surface token: sendMessage(", "signature_anchor");
    pushText("finalizeChatReply", "reply finalization token: finalizeChatReply", "function_name");
  }

  return checks;
}

export function buildAutoChecksForItem(item, itemMap, config) {
  const own = collectOwnSignals(item, config);
  const inheritedSignals = collectInheritedSignals(item, itemMap, config);
  const structuredChecks = buildStructuredChecksForItem(item, itemMap);

  const priorityChecks = [];
  const normalChecks = [];
  const seen = new Set();

  function pushCheck(target, check) {
    const key =
      check.type === "file_exists"
        ? `file:${check.path}`
        : check.type === "basename_exists"
          ? `basename:${String(check.basename || "").toLowerCase()}`
          : check.type === "structured_index_exists"
            ? `structured:${JSON.stringify({
                tableName: String(check.tableName || "").toLowerCase(),
                unique: !!check.unique,
                fields: check.fields || [],
              })}`
            : check.type === "signal_cluster_exists"
              ? `cluster:${JSON.stringify({
                  tokens: check.tokens || [],
                  minMatchedTokens: Number(check.minMatchedTokens || 0),
                  minDistinctFiles: Number(check.minDistinctFiles || 0),
                  strongMatchedTokens: Number(check.strongMatchedTokens || 0),
                  strongDistinctFiles: Number(check.strongDistinctFiles || 0),
                })}`
              : `text:${String(check.token || "").toLowerCase()}:${String(check.evidenceClass || "")}`;

    if (seen.has(key)) return;
    seen.add(key);
    target.push(check);
  }

  if (item.kind === "stage" || item.kind === "substage") {
    for (const path of own.explicitPaths) {
      pushCheck(normalChecks, {
        type: "file_exists",
        path,
        label: `file path: ${path}`,
      });
    }

    for (const cmd of own.commands) {
      pushCheck(normalChecks, {
        type: "text_exists",
        token: cmd,
        label: `command token: ${cmd}`,
        evidenceClass: "command_surface",
      });
    }

    return normalChecks.slice(0, config.maxChecksPerItem);
  }

  for (const structuredCheck of structuredChecks) {
    pushCheck(priorityChecks, structuredCheck);
  }

  const clusterCheck = buildClusterCheck({ own, inheritedSignals, config });
  if (clusterCheck) {
    pushCheck(priorityChecks, clusterCheck);
  }

  const foundationRuntimeChecks = buildFoundationRuntimeChecks(item, own, inheritedSignals);
  for (const check of foundationRuntimeChecks) {
    pushCheck(priorityChecks, check);
  }

  const functionContractChecks = buildFunctionContractChecks(item, own, inheritedSignals);
  for (const check of functionContractChecks) {
    pushCheck(priorityChecks, check);
  }

  for (const path of own.explicitPaths) {
    pushCheck(normalChecks, {
      type: "file_exists",
      path,
      label: `file path: ${path}`,
      evidenceClass: "explicit_file",
    });
  }

  for (const cmd of own.commands) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token: cmd,
      label: `command token: ${cmd}`,
      evidenceClass: "command_surface",
    });
  }

  for (const token of own.signals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `signal token: ${token}`,
      evidenceClass: isWeakGenericToken(token) ? "generic_support" : "semantic_support",
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for signal: ${basename}`,
          evidenceClass: "basename_anchor",
        });
      }
    }
  }

  for (const token of inheritedSignals) {
    pushCheck(normalChecks, {
      type: "text_exists",
      token,
      label: `inherited signal: ${token}`,
      evidenceClass: isWeakGenericToken(token) ? "generic_support" : "semantic_support",
    });

    if (canGenerateBasenameFromSignal(token, config)) {
      for (const basename of buildCandidateBasenamesFromToken(token)) {
        pushCheck(normalChecks, {
          type: "basename_exists",
          basename,
          label: `basename for inherited signal: ${basename}`,
          evidenceClass: "basename_anchor",
        });
      }
    }
  }

  const maxChecks = Math.max(0, config.maxChecksPerItem);
  if (maxChecks === 0) return [];

  const result = [];
  for (const check of priorityChecks) {
    if (result.length >= maxChecks) break;
    result.push(check);
  }

  for (const check of normalChecks) {
    if (result.length >= maxChecks) break;
    result.push(check);
  }

  return result;
}

export {
  buildConfig,
  hasAllowedExtension,
  sortSearchPaths,
};