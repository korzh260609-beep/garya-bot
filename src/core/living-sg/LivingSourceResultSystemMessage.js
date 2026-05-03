// src/core/living-sg/LivingSourceResultSystemMessage.js
// ============================================================================
// LIVING SG — Source Result System Message Builder Skeleton
//
// Purpose:
// - convert a provided sourceResult envelope into prompt-safe system evidence;
// - include compact verified repo facts from payload.projectMap when available;
// - keep prompt evidence separate from planner metadata;
// - make confirmed vs missing/invalid/stale/unconfirmed status explicit;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no source calls here;
// - no repository reads here;
// - no repository writes here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Technical Mode expansion;
// - no slash-command dependency;
// - no promptAssembly runtime wiring yet.
// ============================================================================

import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
} from "./LivingSourceResultEnvelope.js";

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = "-") {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : fallback;
}

function takeList(value, limit = 12) {
  return safeArray(value).slice(0, limit);
}

function getConfirmationStatus(envelope = null) {
  return safeText(envelope?.confirmation?.status, "missing");
}

function getTargetSummary(target = null) {
  if (!isPlainObject(target)) return safeText(target);

  const repository = safeText(target.repository, "");
  const ref = safeText(target.ref, "");
  const path = safeText(target.path, "");
  const scope = safeText(target.scope, "");

  return [
    repository ? `repository=${repository}` : null,
    ref ? `ref=${ref}` : null,
    path ? `path=${path}` : null,
    scope ? `scope=${scope}` : null,
  ].filter(Boolean).join("; ") || "-";
}

function envelopeCanClaimVerifiedFacts(envelope = null) {
  return (
    isPlainObject(envelope) &&
    envelope.canClaimVerifiedFacts === true &&
    getConfirmationStatus(envelope) ===
      LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED
  );
}

function getRepoProjectMap(payload = null) {
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.projectMap)) return payload.projectMap;
  if (isPlainObject(payload.payload?.projectMap)) return payload.payload.projectMap;
  return null;
}

function buildRootListingFacts(projectMap = null) {
  const rootListing = projectMap?.rootListing;
  if (!isPlainObject(rootListing)) return [];

  const directories = takeList(rootListing.directories, 80)
    .map((item) => safeText(item, ""))
    .filter(Boolean);

  const files = takeList(rootListing.files, 80)
    .map((item) => {
      if (typeof item === "string") return safeText(item, "");
      if (isPlainObject(item)) return safeText(item.path, "");
      return "";
    })
    .filter(Boolean);

  return [
    "rootListing:",
    `root.path=${safeText(rootListing.path || "/")}`,
    `root.directories=${directories.length ? directories.join(", ") : "-"}`,
    `root.files=${files.length ? files.join(", ") : "-"}`,
    "Instruction: For repository root folders or root files, answer only from rootListing above.",
  ];
}

function buildLayerFacts(projectMap = null) {
  if (!isPlainObject(projectMap?.layers)) return [];

  return Object.entries(projectMap.layers)
    .filter(([, layer]) => isPlainObject(layer))
    .sort((a, b) => Number(b[1]?.filesCount || 0) - Number(a[1]?.filesCount || 0))
    .slice(0, 18)
    .map(([layerName, layer]) =>
      `- ${safeText(layerName)}: files=${safeNumber(layer.filesCount)}; sample=${takeList(layer.sampleFiles, 8).map((item) => safeText(item, "")).filter(Boolean).join(", ") || "-"}`
    );
}

function buildModuleFacts(projectMap = null) {
  return takeList(projectMap?.modules, 18)
    .map((module) => {
      if (!isPlainObject(module)) return "";
      return `- ${safeText(module.key || module.name || module.rootPath)}: root=${safeText(module.rootPath)}; layer=${safeText(module.layer)}; files=${safeNumber(module.filesCount)}; sample=${takeList(module.sampleFiles, 6).map((item) => safeText(item, "")).filter(Boolean).join(", ") || "-"}`;
    })
    .filter(Boolean);
}

function buildPathFacts(label, values = [], limit = 20) {
  const items = takeList(values, limit)
    .map((item) => {
      if (typeof item === "string") return safeText(item, "");
      if (isPlainObject(item)) return safeText(item.path || item.rootPath || item.key || item.name, "");
      return "";
    })
    .filter(Boolean);

  if (!items.length) return [];
  return [`${label}: ${items.join(", ")}`];
}

function buildRepoFactsFromPayload(envelope = null, verified = false) {
  if (!verified) return [];

  const projectMap = getRepoProjectMap(envelope?.payload);
  if (!projectMap) return [];

  const repo = projectMap.repo || {};
  const totals = projectMap.totals || {};
  const rootListing = buildRootListingFacts(projectMap);
  const layers = buildLayerFacts(projectMap);
  const modules = buildModuleFacts(projectMap);
  const entrypoints = buildPathFacts("entrypoints", projectMap.entrypoints, 20);
  const criticalFiles = buildPathFacts("criticalFiles", projectMap.criticalFiles, 25);

  return [
    "REPO FACTS FROM SOURCE PAYLOAD:",
    `repo.fullName=${safeText(repo.fullName)}`,
    `repo.branch=${safeText(repo.branch)}`,
    `repo.headCommitSha=${safeText(repo.headCommitSha || repo.commitSha || repo.refSha)}`,
    `totals.files=${safeNumber(totals.files)}`,
    `totals.modules=${safeNumber(totals.modules)}`,
    `totals.dependencies=${safeNumber(totals.dependencies)}`,
    `totals.contentLoaded=${safeNumber(totals.contentLoaded)}`,
    `totals.contentSkipped=${safeNumber(totals.contentSkipped)}`,
    `totals.hiddenFiles=${safeNumber(totals.hiddenFiles)}`,
    `totals.structureComplete=${String(totals.structureComplete === true)}`,
    ...rootListing,
    layers.length ? "layers:" : null,
    ...layers,
    modules.length ? "modules:" : null,
    ...modules,
    ...entrypoints,
    ...criticalFiles,
    "Instruction: For repository structure, file count, root listing, layers, modules, entrypoints, and critical files, answer only from REPO FACTS FROM SOURCE PAYLOAD above.",
    "Instruction: Do not invent paths, folders, files, technologies, setup files, licenses, tests, docs, or config folders that are not listed in the payload facts.",
    "Instruction: If the payload facts are incomplete for the user's requested detail, say which exact verified facts are available and what source step is needed next.",
  ].filter(Boolean);
}

function buildMissingEnvelopeMessage() {
  return {
    role: "system",
    content: [
      "SOURCE RESULT SYSTEM EVIDENCE:",
      "status=missing",
      "verified=false",
      "canClaimVerifiedFacts=false",
      "canAuthorizeWrite=false",
      "sourceResultEnvelopePresent=false",
      "Instruction: No sourceResult envelope was provided. Do not present repository/source facts as verified in the current runtime.",
      "Instruction: Use source-honest wording and explain that verified source evidence is missing if source facts are requested.",
      "Safety: This message does not execute sources, read repositories, write repositories, deploy, or authorize any state-changing action.",
      "Safety: A confirmed read result never authorizes write actions.",
    ].join("\n"),
  };
}

export function buildLivingSourceResultSystemMessage(input = {}) {
  const envelope = isPlainObject(input.sourceResultEnvelope)
    ? input.sourceResultEnvelope
    : isPlainObject(input.sourceResult)
      ? input.sourceResult
      : null;

  if (!envelope) {
    return buildMissingEnvelopeMessage();
  }

  const confirmationStatus = getConfirmationStatus(envelope);
  const verified = envelopeCanClaimVerifiedFacts(envelope);
  const kind = safeText(envelope.kind, "unknown");
  const target = getTargetSummary(envelope.target);
  const freshnessStatus = safeText(envelope?.freshness?.status, "unknown");
  const checkedAt = safeText(envelope?.freshness?.checkedAt, "-");
  const sourceUpdatedAt = safeText(envelope?.freshness?.sourceUpdatedAt, "-");
  const confirmedBy = safeText(envelope?.confirmation?.confirmedBy, "-");
  const reason = safeText(envelope?.confirmation?.reason, "-");
  const repoFacts = buildRepoFactsFromPayload(envelope, verified);

  return {
    role: "system",
    content: [
      "SOURCE RESULT SYSTEM EVIDENCE:",
      `status=${confirmationStatus}`,
      `verified=${String(verified)}`,
      `canClaimVerifiedFacts=${String(verified)}`,
      "canAuthorizeWrite=false",
      "sourceResultEnvelopePresent=true",
      `kind=${kind}`,
      `target=${target}`,
      `freshness.status=${freshnessStatus}`,
      `freshness.checkedAt=${checkedAt}`,
      `freshness.sourceUpdatedAt=${sourceUpdatedAt}`,
      `confirmation.confirmedBy=${confirmedBy}`,
      `confirmation.reason=${reason}`,
      verified
        ? "Instruction: This confirmed sourceResult envelope may support verified repository/source claims only for the stated target."
        : "Instruction: This sourceResult envelope is not confirmed for verified claims. Use source-honest wording and do not present repository/source facts as verified.",
      ...repoFacts,
      "Instruction: expectedSourceResultEnvelope, planner metadata, and source-proof metadata are not proof.",
      "Safety: This message does not execute sources, read repositories, write repositories, deploy, or authorize any state-changing action.",
      "Safety: A confirmed read result never authorizes write actions.",
    ].join("\n"),
  };
}

export default {
  buildLivingSourceResultSystemMessage,
};
