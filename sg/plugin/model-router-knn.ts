import type { SgModelTier } from "./model-router.js";

/** Offline candidate. Vectors must come from the same multilingual embedding model. */
export type RouterTrial = {
  tier: SgModelTier;
  succeeded: boolean;
  /** Provider charge for the entire task, including tools and retries, in one currency. */
  totalCost: number;
};

export type RouterExample = {
  taskId: string;
  /** Translations and near duplicates of one task share a family. */
  familyId: string;
  language: string;
  vector: readonly number[];
  trials: readonly RouterTrial[];
};

const TIERS: readonly SgModelTier[] = ["cheap", "medium", "expensive"];

function cosine(left: readonly number[], right: readonly number[]): number | undefined {
  if (!left.length || left.length !== right.length) {
    return undefined;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const b = right[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return undefined;
    }
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : undefined;
}

export type RouterCandidate = {
  tier: SgModelTier;
  neighbors: number;
  estimatedSuccess: number;
  estimatedCost: number;
};

/** Abstains without enough complete, independent task outcomes. Never reads user transcripts. */
export function chooseRouterCandidate(params: {
  vector: readonly number[];
  examples: readonly RouterExample[];
  excludeTaskId?: string;
  excludeFamilyId?: string;
  neighborCount?: number;
  minSuccess?: number;
  minSimilarity?: number;
}): RouterCandidate | undefined {
  const count = params.neighborCount ?? 20;
  const minSuccess = params.minSuccess ?? 0.95;
  const minSimilarity = params.minSimilarity ?? 0.65;
  if (!Number.isInteger(count) || count < 2 || minSuccess < 0 || minSuccess > 1 ||
      minSimilarity < -1 || minSimilarity > 1) {
    return undefined;
  }
  const candidates = params.examples.flatMap((example) => {
    if (example.taskId === params.excludeTaskId || example.familyId === params.excludeFamilyId ||
        !example.taskId || !example.familyId ||
        new Set(example.trials.map((trial) => trial.tier)).size !== TIERS.length ||
        example.trials.length !== TIERS.length ||
        example.trials.some((trial) => typeof trial.succeeded !== "boolean" ||
          !TIERS.includes(trial.tier) || !Number.isFinite(trial.totalCost) || trial.totalCost < 0)) {
      return [];
    }
    const similarity = cosine(params.vector, example.vector);
    if (similarity === undefined || similarity < minSimilarity) {
      return [];
    }
    return [{ example, similarity }];
  }).sort((a, b) => b.similarity - a.similarity);
  const seenFamilies = new Set<string>();
  const neighbors = candidates.filter(({ example }) => {
    if (seenFamilies.has(example.familyId)) {
      return false;
    }
    seenFamilies.add(example.familyId);
    return true;
  }).slice(0, count);
  if (neighbors.length < count) {
    return undefined;
  }
  const options = TIERS.flatMap((tier) => {
    const trials = neighbors.map(({ example }) => example.trials.find((trial) => trial.tier === tier)!);
    const success = trials.filter((trial) => trial.succeeded).length / count;
    if (success < minSuccess) {
      return [];
    }
    // The outcome record already includes any paid retry, so never charge it twice.
    return [{ tier, neighbors: count, estimatedSuccess: success,
      estimatedCost: trials.reduce((sum, trial) => sum + trial.totalCost, 0) / count }];
  });
  return options.sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
}

/** Leave each held-out task out of its own neighbors. Report coverage as well as cost. */
export function evaluateRouterCandidate(examples: readonly RouterExample[], neighborCount = 20) {
  let routed = 0;
  let succeeded = 0;
  let candidateCost = 0;
  let terraCost = 0;
  for (const example of examples) {
    const candidate = chooseRouterCandidate({
      vector: example.vector,
      examples,
      excludeTaskId: example.taskId,
      excludeFamilyId: example.familyId,
      neighborCount,
    });
    if (!candidate) {
      continue;
    }
    const selected = example.trials.find((trial) => trial.tier === candidate.tier);
    const baseline = example.trials.find((trial) => trial.tier === "medium");
    if (!selected || !baseline) {
      continue;
    }
    routed++;
    succeeded += Number(selected.succeeded);
    candidateCost += selected.totalCost;
    terraCost += baseline.totalCost;
  }
  return { total: examples.length, routed, succeeded, candidateCost, terraCost };
}
