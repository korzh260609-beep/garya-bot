// ============================================================================
// === src/core/stageCheck/real/realCandidates.js
// === candidate discovery / repo references / real evidence assembly
// ============================================================================

import {
  collectOwnSignals,
  buildAutoChecksForItem,
} from "../../../bot/handlers/stage-check/signals.js";
import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import {
  uniq,
  isLikelyDescriptiveFile,
} from "./realEvidenceUtils.js";

export function findBasenameInRepo(basename, fileSet) {
  const needle = String(basename || "").trim().toLowerCase();
  if (!needle) return "";

  for (const path of fileSet) {
    const parts = String(path || "").split("/");
    const last = String(parts[parts.length - 1] || "").toLowerCase();
    if (last === needle) return path;
  }

  return "";
}

export function collectCandidateFilesFromScope(scopeWorkflowItems, evaluationCtx) {
  const candidates = [];

  for (const item of scopeWorkflowItems || []) {
    const own = collectOwnSignals(item, evaluationCtx.config);

    for (const explicitPath of own.explicitPaths || []) {
      if (evaluationCtx.fileSet.has(explicitPath)) {
        candidates.push(explicitPath);
      }
    }

    const autoChecks = buildAutoChecksForItem(
      item,
      evaluationCtx.itemMap,
      evaluationCtx.config
    );

    for (const check of autoChecks) {
      if (check?.type === "file_exists" && evaluationCtx.fileSet.has(check.path)) {
        candidates.push(check.path);
      }

      if (check?.type === "basename_exists") {
        const found = findBasenameInRepo(check.basename, evaluationCtx.fileSet);
        if (found) candidates.push(found);
      }
    }
  }

  return uniq(candidates);
}

export function fileMayReferenceCandidate(content, candidatePath) {
  const text = String(content || "");
  const candidate = String(candidatePath || "").trim();
  if (!text || !candidate) return false;

  const filename = candidate.split("/").pop() || candidate;
  const basename = filename.replace(/\.[^.]+$/, "");

  return (
    text.includes(candidate) ||
    text.includes(filename) ||
    text.includes(`./${basename}`) ||
    text.includes(`../${basename}`) ||
    text.includes(`"${basename}"`) ||
    text.includes(`'${basename}'`) ||
    text.includes(`"${filename}"`) ||
    text.includes(`'${filename}'`)
  );
}

export async function findDirectEntrypointMatches({
  entrypoints,
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];

  for (const entrypoint of entrypoints || []) {
    const content = await safeFetchTextFile(entrypoint, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles || []) {
      if (entrypoint === candidate) {
        matches.push({ entrypoint, candidate });
        continue;
      }

      if (fileMayReferenceCandidate(content, candidate)) {
        matches.push({ entrypoint, candidate });
      }
    }
  }

  return matches;
}

export async function findRepoReferenceMatches({
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];
  const searchable = Array.isArray(evaluationCtx.searchableFiles)
    ? evaluationCtx.searchableFiles.slice(0, 220)
    : [];

  for (const filePath of searchable) {
    if (isLikelyDescriptiveFile(filePath)) continue;

    const content = await safeFetchTextFile(filePath, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles || []) {
      if (filePath === candidate) continue;
      if (fileMayReferenceCandidate(content, candidate)) {
        matches.push({ file: filePath, candidate });
      }
    }
  }

  return matches;
}

export function buildRealEvidence({
  candidateFiles,
  connectedness,
  runtimeFoundationEvidence,
  domainEvidence,
}) {
  const evidence = [];

  for (const path of (candidateFiles || []).slice(0, 12)) {
    evidence.push({
      side: "real",
      kind: "candidate_file",
      file: path,
      proofRole: "implementation",
      details: "candidate_file_exists_in_repo",
    });
  }

  const directMatches = Array.isArray(connectedness?.directEntrypointMatches)
    ? connectedness.directEntrypointMatches
    : [];

  for (const match of directMatches.slice(0, 8)) {
    evidence.push({
      side: "real",
      kind: "entrypoint_wiring",
      file: match.candidate,
      entrypoint: match.entrypoint,
      proofRole: "implementation",
      details: "candidate_referenced_from_entrypoint",
    });
  }

  for (const match of (connectedness?.repoReferenceMatches || []).slice(0, 8)) {
    evidence.push({
      side: "real",
      kind: "repo_reference",
      file: match.file,
      candidate: match.candidate,
      proofRole: "implementation",
      details: "candidate_referenced_elsewhere_in_repo",
    });
  }

  for (const item of (runtimeFoundationEvidence || []).slice(0, 12)) {
    evidence.push(item);
  }

  for (const item of (domainEvidence || []).slice(0, 12)) {
    evidence.push(item);
  }

  return evidence;
}

export default {
  findBasenameInRepo,
  collectCandidateFilesFromScope,
  fileMayReferenceCandidate,
  findDirectEntrypointMatches,
  findRepoReferenceMatches,
  buildRealEvidence,
};
