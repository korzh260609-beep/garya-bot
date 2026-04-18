// ============================================================================
// === src/bot/handlers/projectIntentDiag.js
// === 12A.0 intent guard diagnostics (READ-ONLY, monarch-only, private-only)
// Purpose:
// - inspect how SG classifies free-text project intent
// - show classifier result separately from route result
// - diagnostic only, no side effects
// ============================================================================

import { requireProjectMonarchPrivateAccess } from "./projectAccessGuard.js";
import { PROJECT_ONLY_FEATURES } from "./projectAccessScope.js";
import { resolveProjectIntentMatch } from "../../core/projectIntent/projectIntentScope.js";
import { resolveProjectIntentRoute } from "../../core/projectIntent/projectIntentRoute.js";
import { buildProjectIntentRoutePreview } from "../../core/projectIntent/projectIntentRoutePreview.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function quoteBlock(text) {
  if (!text) return "∅";
  return text;
}

function formatList(label, arr) {
  const items = Array.isArray(arr) ? arr : [];
  if (!items.length) return `${label}: []`;
  return `${label}: [${items.join(", ")}]`;
}

export async function handleProjectIntentDiag(ctx = {}) {
  const ok = await requireProjectMonarchPrivateAccess(ctx, {
    feature: PROJECT_ONLY_FEATURES.PROJECT_ARCHITECTURE_ACCESS,
    command: "/project_intent_diag",
  });
  if (!ok) return;

  const input = safeText(ctx.rest);

  if (!input) {
    await ctx.bot.sendMessage(
      ctx.chatId,
      [
        "PROJECT INTENT DIAG",
        "",
        "Usage:",
        "/project_intent_diag <free-text>",
        "",
        "Example:",
        "/project_intent_diag сделай деплой sg",
      ].join("\n")
    );
    return;
  }

  const match = resolveProjectIntentMatch(input);
  const route = resolveProjectIntentRoute({
    text: input,
    isMonarchUser: true,
    isPrivateChat: true,
  });
  const routePreview = buildProjectIntentRoutePreview(route);

  await ctx.bot.sendMessage(
    ctx.chatId,
    [
      "PROJECT INTENT DIAG",
      "",
      `input: ${quoteBlock(input)}`,
      `normalized: ${quoteBlock(match.normalized)}`,
      "",
      formatList("sgCoreStrongAnchorHits", match.sgCoreStrongAnchorHits),
      formatList("sgCoreIdentityPhraseHits", match.sgCoreIdentityPhraseHits),
      formatList("sgCoreIdentityTokenHits", match.sgCoreIdentityTokenHits),
      formatList("strongObjectHits", match.strongObjectHits),
      formatList("weakObjectHits", match.weakObjectHits),
      formatList("userProjectPhraseHits", match.userProjectPhraseHits),
      formatList("userProjectTokenHits", match.userProjectTokenHits),
      formatList("readHits", match.readHits),
      formatList("writeHits", match.writeHits),
      formatList("classificationBasis", match.classificationBasis),
      "",
      formatList("anchorHits", match.anchorHits),
      formatList("internalActionHits", match.internalActionHits),
      formatList("writeActionHits", match.writeActionHits),
      "",
      "Classifier:",
      `targetScope: ${match.targetScope}`,
      `targetDomain: ${match.targetDomain}`,
      `actionMode: ${match.actionMode}`,
      `isProjectInternal: ${String(match.isProjectInternal)}`,
      `isProjectWriteIntent: ${String(match.isProjectWriteIntent)}`,
      `confidence: ${match.confidence}`,
      "",
      "Route:",
      `routeKey: ${route.routeKey}`,
      `policy: ${route.policy}`,
      `allowed: ${String(route.allowed)}`,
      `blocked: ${String(route.blocked)}`,
      `requiresMonarch: ${String(route.requiresMonarch)}`,
      `requiresPrivate: ${String(route.requiresPrivate)}`,
      `readOnly: ${String(route.readOnly)}`,
      "",
      "Policy preview:",
      routePreview.text,
    ].join("\n")
  );
}

export default {
  handleProjectIntentDiag,
};