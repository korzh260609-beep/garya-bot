import type { SgModelTier } from "./model-router.js";

export type RouterTrial = {
  tier: SgModelTier;
  /** Human verified completion, never agent_end.success. */
  succeeded: boolean;
  /** Blind quality score on a shared 0..1 rubric. */
  quality: number;
  /** Entire provider charge for the task, including failed attempts and tools. */
  totalCost: number;
};

export type RouterExample = {
  taskId: string;
  familyId: string;
  language: string;
  vector: readonly number[];
  trials: readonly RouterTrial[];
};

export type RouterCorpus = {
  version: 1;
  embedding: { provider: string; model: string };
  examples: RouterExample[];
};

const TIERS: readonly SgModelTier[] = ["cheap", "medium", "expensive"];

function cosine(left: readonly number[], right: readonly number[]): number | undefined {
  if (!left.length || left.length !== right.length) {
    return undefined;
  }
  let dot = 0,
    leftNorm = 0,
    rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    const a = left[i] ?? Number.NaN,
      b = right[i] ?? Number.NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return undefined;
    }
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : undefined;
}

/** Reject mixed embeddings, duplicates and incomplete or unverified paired trials. */
export function validRouterCorpus(value: unknown): value is RouterCorpus {
  if (!value || typeof value !== "object") {
    return false;
  }
  const corpus = value as Partial<RouterCorpus>;
  if (
    corpus.version !== 1 ||
    !corpus.embedding?.provider?.trim() ||
    !corpus.embedding.model?.trim() ||
    !Array.isArray(corpus.examples)
  ) {
    return false;
  }
  const ids = new Set<string>();
  let dimensions = 0;
  for (const example of corpus.examples) {
    if (
      !example ||
      typeof example.taskId !== "string" ||
      !example.taskId.trim() ||
      ids.has(example.taskId) ||
      typeof example.familyId !== "string" ||
      !example.familyId.trim() ||
      typeof example.language !== "string" ||
      !example.language.trim() ||
      !Array.isArray(example.vector) ||
      !example.vector.length ||
      !example.vector.every(Number.isFinite) ||
      !Array.isArray(example.trials) ||
      example.trials.length !== TIERS.length ||
      example.trials.some((trial) => !trial || typeof trial !== "object") ||
      new Set(example.trials.map((trial) => trial.tier)).size !== TIERS.length ||
      example.trials.some(
        (trial) =>
          !TIERS.includes(trial.tier) ||
          typeof trial.succeeded !== "boolean" ||
          !Number.isFinite(trial.quality) ||
          trial.quality < 0 ||
          trial.quality > 1 ||
          !Number.isFinite(trial.totalCost) ||
          trial.totalCost < 0,
      )
    ) {
      return false;
    }
    if (dimensions && dimensions !== example.vector.length) {
      return false;
    }
    dimensions = example.vector.length;
    ids.add(example.taskId);
  }
  return true;
}

/** 95% Wilson lower bound; a point estimate of 19/20 is not 95% reliable. */
function wilsonLower(successes: number, count: number): number {
  const z = 1.96,
    p = successes / count,
    z2 = z * z;
  return (
    (p + z2 / (2 * count) - z * Math.sqrt((p * (1 - p)) / count + z2 / (4 * count * count))) /
    (1 + z2 / count)
  );
}

export type RouterCandidate = {
  tier: SgModelTier;
  neighbors: number;
  successLowerBound: number;
  estimatedCostPerSuccess: number;
  pairwiseQuality: number;
};

/** One nearest independent example per task family; abstain to Terra on weak evidence. */
export function chooseRouterCandidate(params: {
  vector: readonly number[];
  examples: readonly RouterExample[];
  excludeFamilyId?: string;
  neighborCount?: number;
  minSimilarity?: number;
}): RouterCandidate | undefined {
  const count = params.neighborCount ?? 50;
  const minSimilarity = params.minSimilarity ?? 0.65;
  if (
    !Number.isInteger(count) ||
    count < 2 ||
    !Number.isFinite(minSimilarity) ||
    minSimilarity < -1 ||
    minSimilarity > 1
  ) {
    return undefined;
  }
  const matches = params.examples
    .flatMap((example) => {
      if (example.familyId === params.excludeFamilyId) {
        return [];
      }
      const similarity = cosine(params.vector, example.vector);
      return similarity !== undefined && similarity >= minSimilarity
        ? [{ example, similarity }]
        : [];
    })
    .toSorted((a, b) => b.similarity - a.similarity);
  const families = new Set<string>();
  const neighbors = matches
    .filter(({ example }) => {
      if (families.has(example.familyId)) {
        return false;
      }
      families.add(example.familyId);
      return true;
    })
    .slice(0, count);
  if (neighbors.length < count) {
    return undefined;
  }

  const options = TIERS.flatMap((tier) => {
    const trials = neighbors.map(({ example }) =>
      example.trials.find((trial) => trial.tier === tier)!,
    );
    const successes = trials.filter((trial) => trial.succeeded).length;
    const successLowerBound = wilsonLower(successes, count);
    if (successLowerBound < 0.9) {
      return [];
    }
    // RouteLLM inspired similarity weighted paired ranking against Terra.
    const weights = neighbors.map(({ similarity }) => Math.max(0, similarity));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (!weightSum) {
      return [];
    }
    const pairwiseQuality =
      neighbors.reduce((sum, { example }, index) => {
        const target = trials[index]!;
        const terra = example.trials.find((trial) => trial.tier === "medium")!;
        const left = target.succeeded ? target.quality : -1;
        const right = terra.succeeded ? terra.quality : -1;
        return sum + (weights[index] ?? 0) * (left > right ? 1 : left === right ? 0.5 : 0);
      }, 0) / weightSum;
    if (tier !== "medium" && pairwiseQuality < 0.5) {
      return [];
    }
    const totalCost = trials.reduce(
      (sum, trial, index) => sum + (weights[index] ?? 0) * trial.totalCost,
      0,
    );
    const weightedSuccess = trials.reduce(
      (sum, trial, index) => sum + (trial.succeeded ? (weights[index] ?? 0) : 0),
      0,
    );
    return [
      {
        tier,
        neighbors: count,
        successLowerBound,
        estimatedCostPerSuccess: totalCost / weightedSuccess,
        pairwiseQuality,
      },
    ];
  });
  return options.toSorted((a, b) => a.estimatedCostPerSuccess - b.estimatedCostPerSuccess)[0];
}

/** Family holdout measures real paired outcomes; abstention uses the Terra baseline. */
export function evaluateRouterCandidate(examples: readonly RouterExample[], neighborCount = 50) {
  let routed = 0,
    succeeded = 0,
    candidateCost = 0,
    terraCost = 0;
  let baselineSucceeded = 0;
  const byLanguage: Record<
    string,
    {
      total: number;
      routed: number;
      succeeded: number;
      baselineSucceeded: number;
      candidateCost: number;
      terraCost: number;
    }
  > = {};
  for (const example of examples) {
    const candidate = chooseRouterCandidate({
      vector: example.vector,
      examples,
      excludeFamilyId: example.familyId,
      neighborCount,
    });
    const selected = example.trials.find((trial) => trial.tier === (candidate?.tier ?? "medium"));
    const baseline = example.trials.find((trial) => trial.tier === "medium");
    if (!selected || !baseline) {
      continue;
    }
    routed += Number(Boolean(candidate));
    succeeded += Number(selected.succeeded);
    baselineSucceeded += Number(baseline.succeeded);
    candidateCost += selected.totalCost;
    terraCost += baseline.totalCost;
    const language = (byLanguage[example.language] ??= {
      total: 0,
      routed: 0,
      succeeded: 0,
      baselineSucceeded: 0,
      candidateCost: 0,
      terraCost: 0,
    });
    language.total++;
    language.routed += Number(Boolean(candidate));
    language.succeeded += Number(selected.succeeded);
    language.baselineSucceeded += Number(baseline.succeeded);
    language.candidateCost += selected.totalCost;
    language.terraCost += baseline.totalCost;
  }
  return {
    total: examples.length,
    routed,
    succeeded,
    baselineSucceeded,
    candidateCost,
    terraCost,
    costPerSuccess: succeeded ? candidateCost / succeeded : null,
    terraCostPerSuccess: baselineSucceeded ? terraCost / baselineSucceeded : null,
    byLanguage,
  };
}
