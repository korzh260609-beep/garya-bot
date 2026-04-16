// ============================================================================
// === src/core/stageCheck/real/realEvidenceCollector.js
// === universal real-evidence collector (repo wiring / connectedness)
// ============================================================================

import {
  collectOwnSignals,
  buildAutoChecksForItem,
} from "../../../bot/handlers/stage-check/signals.js";
import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import { buildRealConnectedness } from "./realConnectedness.js";

function uniq(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+/, "")
    .replace(/['"]+$/, "");
}

function parseNodeScriptEntrypoints(scriptText) {
  const text = String(scriptText || "");
  const matches = [];
  const regex = /node\s+(\.\/)?([A-Za-z0-9_./-]+\.(?:js|mjs|cjs|ts|mts|cts))/g;

  let m = null;
  while ((m = regex.exec(text))) {
    matches.push(stripQuotes(m[2] || ""));
  }

  return uniq(matches);
}

async function discoverEntrypoints(evaluationCtx) {
  const entrypoints = [];

  if (evaluationCtx.fileSet.has("package.json")) {
    try {
      const pkgText = await safeFetchTextFile("package.json", evaluationCtx);
      if (pkgText) {
        const pkg = JSON.parse(pkgText);

        if (pkg?.main) {
          entrypoints.push(stripQuotes(pkg.main));
        }

        const scripts = pkg?.scripts || {};
        for (const value of Object.values(scripts)) {
          entrypoints.push(...parseNodeScriptEntrypoints(value));
        }
      }
    } catch (_) {}
  }

  for (const fallback of ["index.js", "src/index.js", "server.js", "app.js"]) {
    if (evaluationCtx.fileSet.has(fallback)) {
      entrypoints.push(fallback);
    }
  }

  return uniq(entrypoints).filter((x) => evaluationCtx.fileSet.has(x));
}

function findBasenameInRepo(basename, fileSet) {
  const needle = String(basename || "").trim().toLowerCase();
  if (!needle) return "";

  for (const path of fileSet) {
    const parts = String(path || "").split("/");
    const last = String(parts[parts.length - 1] || "").toLowerCase();
    if (last === needle) return path;
  }

  return "";
}

function collectCandidateFilesFromScope(scopeWorkflowItems, evaluationCtx) {
  const candidates = [];

  for (const item of scopeWorkflowItems) {
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

function fileMayReferenceCandidate(content, candidatePath) {
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

async function findDirectEntrypointMatches({
  entrypoints,
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];

  for (const entrypoint of entrypoints) {
    const content = await safeFetchTextFile(entrypoint, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles) {
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

async function findRepoReferenceMatches({
  candidateFiles,
  evaluationCtx,
}) {
  const matches = [];
  const searchable = Array.isArray(evaluationCtx.searchableFiles)
    ? evaluationCtx.searchableFiles.slice(0, 220)
    : [];

  for (const filePath of searchable) {
    const content = await safeFetchTextFile(filePath, evaluationCtx);
    if (!content) continue;

    for (const candidate of candidateFiles) {
      if (filePath === candidate) continue;
      if (fileMayReferenceCandidate(content, candidate)) {
        matches.push({ file: filePath, candidate });
      }
    }
  }

  return matches;
}

function buildRealEvidence({
  entrypoints,
  candidateFiles,
  connectedness,
}) {
  const evidence = [];

  for (const path of candidateFiles.slice(0, 12)) {
    evidence.push({
      side: "real",
      kind: "candidate_file",
      file: path,
      details: "candidate_file_exists_in_repo",
    });
  }

  for (const path of entrypoints.slice(0, 6)) {
    evidence.push({
      side: "real",
      kind: "entrypoint",
      file: path,
      details: "discovered_runtime_entrypoint",
    });
  }

  for (const match of (connectedness?.directEntrypointMatches || []).slice(0, 8)) {
    evidence.push({
      side: "real",
      kind: "entrypoint_wiring",
      file: match.candidate,
      entrypoint: match.entrypoint,
      details: "candidate_referenced_from_entrypoint",
    });
  }

  for (const match of (connectedness?.repoReferenceMatches || []).slice(0, 8)) {
    evidence.push({
      side: "real",
      kind: "repo_reference",
      file: match.file,
      candidate: match.candidate,
      details: "candidate_referenced_elsewhere_in_repo",
    });
  }

  return evidence;
}

export async function collectRealEvidence({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const entrypoints = await discoverEntrypoints(evaluationCtx);
  const candidateFiles = collectCandidateFilesFromScope(
    scopeWorkflowItems,
    evaluationCtx
  );

  const directEntrypointMatches = await findDirectEntrypointMatches({
    entrypoints,
    candidateFiles,
    evaluationCtx,
  });

  const repoReferenceMatches = await findRepoReferenceMatches({
    candidateFiles,
    evaluationCtx,
  });

  const connectedness = buildRealConnectedness({
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
  });

  const evidence = buildRealEvidence({
    entrypoints,
    candidateFiles,
    connectedness,
  });

  return {
    entrypoints,
    candidateFiles,
    directEntrypointMatches,
    repoReferenceMatches,
    connectedness,
    evidence,
  };
}

export default {
  collectRealEvidence,
};