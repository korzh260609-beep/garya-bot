// ============================================================================
// === src/core/stageCheck/real/realConnectedness.js
// === evaluates connectedness of candidate files to entrypoints / repo usage
// ============================================================================

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqStrings(values) {
  return Array.from(
    new Set(
      toArray(values)
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

export function buildRealConnectedness({
  entrypoints = [],
  candidateFiles = [],
  directEntrypointMatches = [],
  repoReferenceMatches = [],
} = {}) {
  const normalizedEntrypoints = uniqStrings(entrypoints);
  const normalizedCandidates = uniqStrings(candidateFiles);

  const normalizedDirect = toArray(directEntrypointMatches)
    .filter(Boolean)
    .map((x) => ({
      entrypoint: String(x.entrypoint || "").trim(),
      candidate: String(x.candidate || "").trim(),
    }))
    .filter((x) => x.entrypoint && x.candidate);

  const normalizedRepoRefs = toArray(repoReferenceMatches)
    .filter(Boolean)
    .map((x) => ({
      file: String(x.file || "").trim(),
      candidate: String(x.candidate || "").trim(),
    }))
    .filter((x) => x.file && x.candidate);

  const directEntrypointCount = normalizedDirect.length;
  const distinctRepoRefFiles = new Set(normalizedRepoRefs.map((x) => x.file)).size;
  const distinctReferencedCandidates = new Set(
    normalizedRepoRefs.map((x) => x.candidate)
  ).size;

  let strength = "none";

  if (
    normalizedCandidates.length > 0 &&
    (directEntrypointCount > 0 || distinctRepoRefFiles >= 3)
  ) {
    strength = "strong";
  } else if (
    normalizedCandidates.length > 0 &&
    (distinctRepoRefFiles >= 1 || distinctReferencedCandidates >= 1)
  ) {
    strength = "medium";
  } else if (normalizedCandidates.length > 0) {
    strength = "weak";
  }

  return {
    entrypoints: normalizedEntrypoints,
    candidateFiles: normalizedCandidates,
    directEntrypointMatches: normalizedDirect,
    repoReferenceMatches: normalizedRepoRefs,
    directEntrypointCount,
    distinctRepoRefFiles,
    distinctReferencedCandidates,
    strength,
  };
}

export default {
  buildRealConnectedness,
};