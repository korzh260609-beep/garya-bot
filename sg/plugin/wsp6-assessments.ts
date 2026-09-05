import { createHash, randomUUID } from "node:crypto";
import type { PluginStateKeyedStore } from "openclaw/plugin-sdk/plugin-state-runtime";
import { openWsp6SqliteStores } from "./wsp6-store.js";

export type SgAssessmentKind = "knowledge" | "profile";
export type SgAssessmentStatus = "draft" | "active" | "closed";
export type SgAssessmentScope =
  | { kind: "personal"; globalId: string }
  | { kind: "resource"; resourceScopeId: string };
export type SgAssessmentDimension = { key: string; label: string };
export type SgAssessmentProfile = { key: string; title: string; description: string };
export type SgAssessmentOption = {
  optionId: string;
  label: string;
  points?: number;
  scores?: Record<string, number>;
  scoreKey?: string;
};
export type SgAssessmentQuestion = {
  questionId: string;
  prompt: string;
  options: SgAssessmentOption[];
};
export type SgAssessmentDefinition = {
  version: 2;
  testId: string;
  scope: SgAssessmentScope;
  title: string;
  kind: SgAssessmentKind;
  status: SgAssessmentStatus;
  dimensions: SgAssessmentDimension[];
  results: SgAssessmentProfile[];
  questions: SgAssessmentQuestion[];
  createdByGlobalId: string;
  createdAt: string;
  updatedAt: string;
};
export type SgAssessmentAnswer = {
  questionId: string;
  optionId: string;
  answeredAt: string;
};
export type SgAssessmentAttempt = {
  version: 2;
  attemptId: string;
  testId: string;
  scope: SgAssessmentScope;
  globalId: string;
  status: "active" | "completed";
  answers: SgAssessmentAnswer[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
export type SgAssessmentQuestionView = {
  attemptId: string;
  testId: string;
  title: string;
  questionId: string;
  questionNumber: number;
  questionCount: number;
  prompt: string;
  options: Array<{ optionId: string; label: string }>;
};
export type SgKnowledgeResult = {
  kind: "knowledge";
  score: number;
  maxScore: number;
  percent: number;
};
export type SgProfileResult = {
  kind: "profile";
  mode: "dimensions";
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    percent: number;
  }>;
};
export type SgCategoricalProfileResult = {
  kind: "profile";
  mode: "categories";
  keys: string[];
  profiles: SgAssessmentProfile[];
  counts: Record<string, number>;
};
export type SgAssessmentResult = SgKnowledgeResult | SgProfileResult | SgCategoricalProfileResult;
export type SgAssessmentStats = {
  testId: string;
  completedAttempts: number;
  distinctParticipants: number;
  aggregateAvailable: boolean;
  knowledgeAveragePercent?: number;
  profileAveragePercent?: Array<{ key: string; label: string; percent: number }>;
  profileCounts?: Array<{ key: string; title: string; count: number }>;
};

type SgAssessmentStores = {
  definitions: PluginStateKeyedStore<SgAssessmentDefinition>;
  attempts: PluginStateKeyedStore<SgAssessmentAttempt>;
};

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const MAX_QUESTIONS = 50;
const MAX_DIMENSIONS = 8;
const MAX_RESULTS = 30;
const MIN_PRIVATE_AGGREGATE_SIZE = 3;
const INTERACTIVE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16}$/u;

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}

function boundedText(value: string, max: number, code: string): string {
  const normalized = required(value, code);
  if (normalized.length > max) {
    throw new Error(code);
  }
  return normalized;
}

function optionalBoundedText(value: string | undefined, max: number, code: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length > max) {
    throw new Error(code);
  }
  return normalized;
}

function identifier(value: string, code: string): string {
  const normalized = required(value, code).toLowerCase();
  if (!ID_PATTERN.test(normalized)) {
    throw new Error(code);
  }
  return normalized;
}

function integerScore(value: unknown, code: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    throw new Error(code);
  }
  return value as number;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function validAssessmentScope(value: unknown): value is SgAssessmentScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<SgAssessmentScope>;
  return item.kind === "personal"
    ? Object.keys(value).length === 2 &&
        typeof item.globalId === "string" &&
        Boolean(item.globalId.trim())
    : item.kind === "resource" &&
        Object.keys(value).length === 2 &&
        typeof item.resourceScopeId === "string" &&
        Boolean(item.resourceScopeId.trim());
}

export function sameAssessmentScope(left: SgAssessmentScope, right: SgAssessmentScope): boolean {
  return left.kind === "personal" && right.kind === "personal"
    ? left.globalId === right.globalId
    : left.kind === "resource" && right.kind === "resource"
      ? left.resourceScopeId === right.resourceScopeId
      : false;
}

function assessmentScopeKey(scope: SgAssessmentScope): string {
  return scope.kind === "personal"
    ? `personal:${required(scope.globalId, "sg-test-personal-scope-required")}`
    : `resource:${required(scope.resourceScopeId, "sg-test-resource-scope-required")}`;
}

function validateDefinitionInput(input: {
  scope: SgAssessmentScope;
  title: string;
  kind: SgAssessmentKind;
  dimensions?: SgAssessmentDimension[];
  results?: SgAssessmentProfile[];
  questions: SgAssessmentQuestion[];
}): Pick<
  SgAssessmentDefinition,
  "scope" | "title" | "kind" | "dimensions" | "results" | "questions"
> {
  if (!validAssessmentScope(input.scope)) {
    throw new Error("sg-test-scope-invalid");
  }
  const scope = structuredClone(input.scope);
  const title = boundedText(input.title, 160, "sg-test-title-invalid");
  if (input.kind !== "knowledge" && input.kind !== "profile") {
    throw new Error("sg-test-kind-invalid");
  }
  if (
    !Array.isArray(input.questions) ||
    input.questions.length < 1 ||
    input.questions.length > MAX_QUESTIONS
  ) {
    throw new Error("sg-test-questions-invalid");
  }
  const dimensions = (input.dimensions ?? []).map((dimension) => ({
    key: identifier(dimension.key, "sg-test-dimension-invalid"),
    label: boundedText(dimension.label, 80, "sg-test-dimension-invalid"),
  }));
  if (!unique(dimensions.map((dimension) => dimension.key))) {
    throw new Error("sg-test-dimension-duplicate");
  }
  const results = (input.results ?? []).map((result) => ({
    key: boundedText(result.key, 40, "sg-test-result-invalid"),
    title: boundedText(result.title || result.key, 200, "sg-test-result-invalid"),
    description: optionalBoundedText(result.description, 1_200, "sg-test-result-invalid"),
  }));
  if (results.length > MAX_RESULTS) {
    throw new Error("sg-test-results-invalid");
  }
  if (!unique(results.map((result) => result.key))) {
    throw new Error("sg-test-result-duplicate");
  }
  if (input.kind === "knowledge" && (dimensions.length > 0 || results.length > 0)) {
    throw new Error("sg-test-knowledge-dimensions-forbidden");
  }
  if (input.kind === "profile" && dimensions.length > 0 && results.length > 0) {
    throw new Error("sg-test-profile-mode-ambiguous");
  }
  if (
    input.kind === "profile" &&
    results.length === 0 &&
    (dimensions.length < 1 || dimensions.length > MAX_DIMENSIONS)
  ) {
    throw new Error("sg-test-profile-dimensions-required");
  }
  const dimensionKeys = new Set(dimensions.map((dimension) => dimension.key));
  const questions = input.questions.map((question) => {
    const questionId = identifier(question.questionId, "sg-test-question-id-invalid");
    const prompt = boundedText(question.prompt, 240, "sg-test-question-prompt-invalid");
    if (
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      question.options.length > 4
    ) {
      throw new Error("sg-test-question-options-invalid");
    }
    const options = question.options.map((option, optionIndex) => {
      const optionId = identifier(option.optionId, "sg-test-option-id-invalid");
      const label = boundedText(option.label, 80, "sg-test-option-label-invalid");
      if (input.kind === "knowledge") {
        if (option.scores !== undefined) {
          throw new Error("sg-test-knowledge-scores-forbidden");
        }
        return {
          optionId,
          label,
          points: integerScore(option.points, "sg-test-option-points-invalid"),
        };
      }
      if (option.points !== undefined) {
        throw new Error("sg-test-profile-points-forbidden");
      }
      if (results.length > 0) {
        if (option.scores !== undefined) {
          throw new Error("sg-test-profile-scores-forbidden");
        }
        return {
          optionId,
          label,
          scoreKey: boundedText(
            option.scoreKey ?? results[optionIndex]?.key ?? String(optionIndex + 1),
            40,
            "sg-test-option-score-key-invalid",
          ),
        };
      }
      const rawScores = option.scores ?? {};
      if (Object.keys(rawScores).some((key) => !dimensionKeys.has(key))) {
        throw new Error("sg-test-option-dimension-unknown");
      }
      return {
        optionId,
        label,
        scores: Object.fromEntries(
          dimensions.map((dimension) => [
            dimension.key,
            integerScore(rawScores[dimension.key] ?? 0, "sg-test-option-score-invalid"),
          ]),
        ),
      };
    });
    if (
      !unique(options.map((option) => option.optionId)) ||
      !unique(options.map((option) => option.label.toLowerCase()))
    ) {
      throw new Error("sg-test-question-options-duplicate");
    }
    if (
      input.kind === "knowledge" &&
      Math.max(...options.map((option) => option.points ?? 0)) === 0
    ) {
      throw new Error("sg-test-question-max-score-zero");
    }
    return { questionId, prompt, options };
  });
  if (!unique(questions.map((question) => question.questionId))) {
    throw new Error("sg-test-question-id-duplicate");
  }
  if (input.kind === "profile") {
    for (const dimension of dimensions) {
      const maximum = questions.reduce(
        (total, question) =>
          total +
          Math.max(...question.options.map((option) => option.scores?.[dimension.key] ?? 0)),
        0,
      );
      if (maximum === 0) {
        throw new Error("sg-test-dimension-max-score-zero");
      }
    }
  }
  return { scope, title, kind: input.kind, dimensions, results, questions };
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validDefinition(value: unknown): value is SgAssessmentDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgAssessmentDefinition>;
  try {
    if (
      item.version !== 2 ||
      typeof item.testId !== "string" ||
      !ID_PATTERN.test(item.testId) ||
      !["draft", "active", "closed"].includes(item.status ?? "") ||
      typeof item.createdByGlobalId !== "string" ||
      !validTimestamp(item.createdAt) ||
      !validTimestamp(item.updatedAt)
    ) {
      return false;
    }
    validateDefinitionInput({
      scope: item.scope as SgAssessmentScope,
      title: item.title ?? "",
      kind: item.kind as SgAssessmentKind,
      dimensions: item.dimensions,
      results: item.results,
      questions: item.questions ?? [],
    });
    return true;
  } catch {
    return false;
  }
}

function normalizedStoredDefinition(value: unknown): SgAssessmentDefinition | undefined {
  if (!validDefinition(value)) {
    return undefined;
  }
  return {
    ...value,
    dimensions: value.dimensions ?? [],
    results: value.results ?? [],
  };
}

function validAttempt(value: unknown): value is SgAssessmentAttempt {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgAssessmentAttempt>;
  return (
    item.version === 2 &&
    typeof item.attemptId === "string" &&
    item.attemptId.startsWith("att_") &&
    typeof item.testId === "string" &&
    validAssessmentScope(item.scope) &&
    typeof item.globalId === "string" &&
    (item.status === "active" || item.status === "completed") &&
    Array.isArray(item.answers) &&
    item.answers.every(
      (answer) =>
        answer &&
        typeof answer.questionId === "string" &&
        typeof answer.optionId === "string" &&
        validTimestamp(answer.answeredAt),
    ) &&
    validTimestamp(item.createdAt) &&
    validTimestamp(item.updatedAt) &&
    (item.completedAt === undefined || validTimestamp(item.completedAt))
  );
}

function attemptSlotKey(input: {
  scope: SgAssessmentScope;
  testId: string;
  globalId: string;
}): string {
  const digest = createHash("sha256")
    .update(`${assessmentScopeKey(input.scope)}\0${input.testId}\0${input.globalId}`)
    .digest("hex");
  return `active:${digest}`;
}

function attemptHistoryKey(attemptId: string): string {
  return `history:${attemptId}`;
}

function definitionKey(scope: SgAssessmentScope, testId: string): string {
  const digest = createHash("sha256").update(assessmentScopeKey(scope)).digest("hex");
  return `test:${digest}:${testId}`;
}

export function assessmentInteractiveToken(
  definition: Pick<SgAssessmentDefinition, "scope" | "testId">,
): string {
  return createHash("sha256")
    .update(`${assessmentScopeKey(definition.scope)}\0${definition.testId}`)
    .digest("base64url")
    .slice(0, 16);
}

function requireAtomicUpdate<T>(store: PluginStateKeyedStore<T>) {
  if (!store.update) {
    throw new Error("sg-test-atomic-store-required");
  }
  return store.update.bind(store);
}

function questionView(
  definition: SgAssessmentDefinition,
  attempt: SgAssessmentAttempt,
): SgAssessmentQuestionView | undefined {
  const question = definition.questions[attempt.answers.length];
  if (!question) {
    return undefined;
  }
  return {
    attemptId: attempt.attemptId,
    testId: definition.testId,
    title: definition.title,
    questionId: question.questionId,
    questionNumber: attempt.answers.length + 1,
    questionCount: definition.questions.length,
    prompt: question.prompt,
    options: question.options.map(({ optionId, label }) => ({ optionId, label })),
  };
}

function assessmentResult(
  definition: SgAssessmentDefinition,
  attempt: SgAssessmentAttempt,
): SgAssessmentResult {
  const selected = new Map(attempt.answers.map((answer) => [answer.questionId, answer.optionId]));
  if (definition.kind === "knowledge") {
    let score = 0;
    let maxScore = 0;
    for (const question of definition.questions) {
      const option = question.options.find(
        (candidate) => candidate.optionId === selected.get(question.questionId),
      );
      score += option?.points ?? 0;
      maxScore += Math.max(...question.options.map((candidate) => candidate.points ?? 0));
    }
    return {
      kind: "knowledge",
      score,
      maxScore,
      percent: maxScore === 0 ? 0 : roundPercent((score / maxScore) * 100),
    };
  }
  if (definition.results.length > 0) {
    const counts = new Map<string, number>();
    for (const question of definition.questions) {
      const option = question.options.find(
        (candidate) => candidate.optionId === selected.get(question.questionId),
      );
      if (option?.scoreKey) {
        counts.set(option.scoreKey, (counts.get(option.scoreKey) ?? 0) + 1);
      }
    }
    const maximum = Math.max(0, ...counts.values());
    const keys = [...counts.entries()].filter(([, count]) => count === maximum).map(([key]) => key);
    return {
      kind: "profile",
      mode: "categories",
      keys,
      profiles: definition.results.filter((profile) => keys.includes(profile.key)),
      counts: Object.fromEntries(counts),
    };
  }
  return {
    kind: "profile",
    mode: "dimensions",
    dimensions: definition.dimensions.map((dimension) => {
      let score = 0;
      let maxScore = 0;
      for (const question of definition.questions) {
        const option = question.options.find(
          (candidate) => candidate.optionId === selected.get(question.questionId),
        );
        score += option?.scores?.[dimension.key] ?? 0;
        maxScore += Math.max(
          ...question.options.map((candidate) => candidate.scores?.[dimension.key] ?? 0),
        );
      }
      return {
        ...dimension,
        score,
        maxScore,
        percent: maxScore === 0 ? 0 : roundPercent((score / maxScore) * 100),
      };
    }),
  };
}

export function openSgAssessmentStores(stateDir: string): SgAssessmentStores {
  const stores = openWsp6SqliteStores(stateDir);
  return {
    definitions: stores.definitions as PluginStateKeyedStore<SgAssessmentDefinition>,
    attempts: stores.attempts as PluginStateKeyedStore<SgAssessmentAttempt>,
  };
}

export class SgAssessmentRegistry {
  constructor(private readonly stores: SgAssessmentStores) {}

  async create(input: {
    testId?: string;
    scope: SgAssessmentScope;
    title: string;
    kind: SgAssessmentKind;
    dimensions?: SgAssessmentDimension[];
    results?: SgAssessmentProfile[];
    questions: SgAssessmentQuestion[];
    actorGlobalId: string;
  }): Promise<SgAssessmentDefinition> {
    const normalized = validateDefinitionInput(input);
    const testId = input.testId
      ? identifier(input.testId, "sg-test-id-invalid")
      : `tst_${randomUUID().replaceAll("-", "")}`;
    const now = new Date().toISOString();
    const definition: SgAssessmentDefinition = {
      version: 2,
      testId,
      ...normalized,
      status: "draft",
      createdByGlobalId: required(input.actorGlobalId, "sg-test-actor-required"),
      createdAt: now,
      updatedAt: now,
    };
    if (
      !(await this.stores.definitions.registerIfAbsent(
        definitionKey(definition.scope, testId),
        definition,
      ))
    ) {
      throw new Error("sg-test-id-exists");
    }
    return definition;
  }

  async findDefinition(
    testId: string,
    scope: SgAssessmentScope,
  ): Promise<SgAssessmentDefinition | undefined> {
    const value = await this.stores.definitions.lookup(
      definitionKey(scope, identifier(testId, "sg-test-id-invalid")),
    );
    if (value === undefined) {
      return undefined;
    }
    const definition = normalizedStoredDefinition(value);
    if (!definition) {
      throw new Error("sg-test-definition-corrupt");
    }
    return definition;
  }

  async listDefinitions(scope: SgAssessmentScope): Promise<SgAssessmentDefinition[]> {
    if (!validAssessmentScope(scope)) {
      throw new Error("sg-test-scope-invalid");
    }
    const definitions = (await this.stores.definitions.entries()).map((entry) =>
      normalizedStoredDefinition(entry.value),
    );
    if (definitions.some((definition) => !definition)) {
      throw new Error("sg-test-definition-corrupt");
    }
    return definitions
      .filter((definition): definition is SgAssessmentDefinition =>
        Boolean(definition && sameAssessmentScope(definition.scope, scope)),
      )
      .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async findDefinitionByInteractiveToken(
    token: string,
  ): Promise<SgAssessmentDefinition | undefined> {
    const normalized = token.trim();
    if (!INTERACTIVE_TOKEN_PATTERN.test(normalized)) {
      throw new Error("sg-test-interactive-token-invalid");
    }
    const definitions = (await this.stores.definitions.entries()).map((entry) =>
      normalizedStoredDefinition(entry.value),
    );
    if (definitions.some((definition) => !definition)) {
      throw new Error("sg-test-definition-corrupt");
    }
    const matches = definitions.filter((definition): definition is SgAssessmentDefinition =>
      Boolean(definition && assessmentInteractiveToken(definition) === normalized),
    );
    if (matches.length > 1) {
      throw new Error("sg-test-interactive-token-ambiguous");
    }
    return matches[0];
  }

  async setStatus(
    testId: string,
    status: Exclude<SgAssessmentStatus, "draft">,
    scope: SgAssessmentScope,
  ): Promise<SgAssessmentDefinition> {
    const key = definitionKey(scope, identifier(testId, "sg-test-id-invalid"));
    let updated: SgAssessmentDefinition | undefined;
    await requireAtomicUpdate(this.stores.definitions)(key, (current) => {
      if (!current) {
        throw new Error("sg-test-not-found");
      }
      const definition = normalizedStoredDefinition(current);
      if (!definition) {
        throw new Error("sg-test-definition-corrupt");
      }
      if (status === "active" && definition.status === "closed") {
        throw new Error("sg-test-closed");
      }
      updated = { ...definition, status, updatedAt: new Date().toISOString() };
      return updated;
    });
    if (!updated) {
      throw new Error("sg-test-state-update-failed");
    }
    return updated;
  }

  async start(input: { testId: string; scope: SgAssessmentScope; globalId: string }): Promise<{
    status: "started" | "resumed";
    attempt: SgAssessmentAttempt;
    question: SgAssessmentQuestionView;
  }> {
    const definition = await this.findDefinition(input.testId, input.scope);
    if (!definition) {
      throw new Error("sg-test-not-found");
    }
    if (definition.status !== "active") {
      throw new Error("sg-test-not-active");
    }
    const globalId = required(input.globalId, "sg-test-participant-required");
    const key = attemptSlotKey({ scope: definition.scope, testId: definition.testId, globalId });
    const candidate: SgAssessmentAttempt = {
      version: 2,
      attemptId: `att_${randomUUID().replaceAll("-", "")}`,
      testId: definition.testId,
      scope: structuredClone(definition.scope),
      globalId,
      status: "active",
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let previousCompleted: SgAssessmentAttempt | undefined;
    let selected: SgAssessmentAttempt | undefined;
    let status: "started" | "resumed" = "started";
    await requireAtomicUpdate(this.stores.attempts)(key, (current) => {
      if (current !== undefined && !validAttempt(current)) {
        throw new Error("sg-test-attempt-corrupt");
      }
      if (current?.status === "active") {
        selected = current;
        status = "resumed";
        return current;
      }
      previousCompleted = current;
      selected = candidate;
      return candidate;
    });
    if (previousCompleted) {
      await this.stores.attempts.register(
        attemptHistoryKey(previousCompleted.attemptId),
        previousCompleted,
      );
    }
    if (!selected) {
      throw new Error("sg-test-attempt-start-failed");
    }
    const question = questionView(definition, selected);
    if (!question) {
      throw new Error("sg-test-question-missing");
    }
    return { status, attempt: selected, question };
  }

  async answer(input: {
    attemptId: string;
    globalId: string;
    questionId: string;
    answer: string;
  }): Promise<
    | { status: "next"; attempt: SgAssessmentAttempt; question: SgAssessmentQuestionView }
    | { status: "completed"; attempt: SgAssessmentAttempt; result: SgAssessmentResult }
  > {
    const attempt = await this.findOwnedAttempt(input.attemptId, input.globalId);
    const definition = await this.findDefinition(attempt.testId, attempt.scope);
    if (!definition) {
      throw new Error("sg-test-not-found");
    }
    const key = attemptSlotKey({
      scope: attempt.scope,
      testId: attempt.testId,
      globalId: attempt.globalId,
    });
    let updated: SgAssessmentAttempt | undefined;
    await requireAtomicUpdate(this.stores.attempts)(key, (current) => {
      if (!current || !validAttempt(current) || current.attemptId !== attempt.attemptId) {
        throw new Error("sg-test-attempt-not-active");
      }
      const questionId = identifier(input.questionId, "sg-test-question-id-invalid");
      const existing = current.answers.find((item) => item.questionId === questionId);
      const question = definition.questions.find((item) => item.questionId === questionId);
      if (!question) {
        throw new Error("sg-test-question-not-found");
      }
      const normalizedAnswer = required(input.answer, "sg-test-answer-required").toLowerCase();
      const option = question.options.find(
        (candidate) =>
          candidate.optionId.toLowerCase() === normalizedAnswer ||
          candidate.label.toLowerCase() === normalizedAnswer,
      );
      if (!option) {
        throw new Error("sg-test-answer-invalid");
      }
      if (existing) {
        if (existing.optionId !== option.optionId) {
          throw new Error("sg-test-answer-conflict");
        }
        updated = current;
        return current;
      }
      if (current.status !== "active") {
        throw new Error("sg-test-attempt-completed");
      }
      const expected = definition.questions[current.answers.length];
      if (expected?.questionId !== question.questionId) {
        throw new Error("sg-test-answer-out-of-order");
      }
      const now = new Date().toISOString();
      const answers = [
        ...current.answers,
        { questionId: question.questionId, optionId: option.optionId, answeredAt: now },
      ];
      const completed = answers.length === definition.questions.length;
      updated = {
        ...current,
        answers,
        status: completed ? "completed" : "active",
        updatedAt: now,
        ...(completed ? { completedAt: now } : {}),
      };
      return updated;
    });
    if (!updated) {
      throw new Error("sg-test-answer-update-failed");
    }
    if (updated.status === "completed") {
      await this.stores.attempts.register(attemptHistoryKey(updated.attemptId), updated);
      return {
        status: "completed",
        attempt: updated,
        result: assessmentResult(definition, updated),
      };
    }
    const next = questionView(definition, updated);
    if (!next) {
      throw new Error("sg-test-question-missing");
    }
    return { status: "next", attempt: updated, question: next };
  }

  async findOwnedAttempt(attemptId: string, globalId: string): Promise<SgAssessmentAttempt> {
    const normalizedAttempt = required(attemptId, "sg-test-attempt-id-required");
    const normalizedGlobalId = required(globalId, "sg-test-participant-required");
    const entries = await this.stores.attempts.entries();
    const value = entries.find((entry) => {
      const candidate = entry.value as Partial<SgAssessmentAttempt> | undefined;
      return candidate?.attemptId === normalizedAttempt;
    })?.value;
    if (!value) {
      throw new Error("sg-test-attempt-not-found");
    }
    if (!validAttempt(value)) {
      throw new Error("sg-test-attempt-corrupt");
    }
    if (value.globalId !== normalizedGlobalId) {
      throw new Error("sg-test-attempt-owner-required");
    }
    return value;
  }

  async resume(
    attemptId: string,
    globalId: string,
  ): Promise<
    | { status: "active"; attempt: SgAssessmentAttempt; question: SgAssessmentQuestionView }
    | { status: "completed"; attempt: SgAssessmentAttempt; result: SgAssessmentResult }
  > {
    const attempt = await this.findOwnedAttempt(attemptId, globalId);
    const definition = await this.findDefinition(attempt.testId, attempt.scope);
    if (!definition) {
      throw new Error("sg-test-not-found");
    }
    if (attempt.status === "completed") {
      return { status: "completed", attempt, result: assessmentResult(definition, attempt) };
    }
    const question = questionView(definition, attempt);
    if (!question) {
      throw new Error("sg-test-question-missing");
    }
    return { status: "active", attempt, question };
  }

  async stats(testId: string, scope: SgAssessmentScope): Promise<SgAssessmentStats> {
    const definition = await this.findDefinition(testId, scope);
    if (!definition) {
      throw new Error("sg-test-not-found");
    }
    const byAttempt = new Map<string, SgAssessmentAttempt>();
    for (const entry of await this.stores.attempts.entries()) {
      if (!validAttempt(entry.value)) {
        throw new Error("sg-test-attempt-corrupt");
      }
      if (
        entry.value.testId === definition.testId &&
        sameAssessmentScope(entry.value.scope, definition.scope) &&
        entry.value.status === "completed"
      ) {
        byAttempt.set(entry.value.attemptId, entry.value);
      }
    }
    const attempts = [...byAttempt.values()];
    const distinctParticipants = new Set(attempts.map((attempt) => attempt.globalId)).size;
    const base: SgAssessmentStats = {
      testId: definition.testId,
      completedAttempts: attempts.length,
      distinctParticipants,
      aggregateAvailable: distinctParticipants >= MIN_PRIVATE_AGGREGATE_SIZE,
    };
    if (!base.aggregateAvailable) {
      return base;
    }
    const results = attempts.map((attempt) => assessmentResult(definition, attempt));
    if (definition.kind === "knowledge") {
      const total = results.reduce(
        (sum, result) => sum + (result.kind === "knowledge" ? result.percent : 0),
        0,
      );
      return { ...base, knowledgeAveragePercent: roundPercent(total / results.length) };
    }
    return {
      ...base,
      ...(definition.results.length > 0
        ? {
            profileCounts: definition.results.map((profile) => ({
              key: profile.key,
              title: profile.title,
              count: results.reduce(
                (sum, result) =>
                  sum +
                  (result.kind === "profile" &&
                  result.mode === "categories" &&
                  result.keys.includes(profile.key)
                    ? 1
                    : 0),
                0,
              ),
            })),
          }
        : {
            profileAveragePercent: definition.dimensions.map((dimension) => ({
              key: dimension.key,
              label: dimension.label,
              percent: roundPercent(
                results.reduce((sum, result) => {
                  if (result.kind !== "profile" || result.mode !== "dimensions") {
                    return sum;
                  }
                  return (
                    sum +
                    (result.dimensions.find((item) => item.key === dimension.key)?.percent ?? 0)
                  );
                }, 0) / results.length,
              ),
            })),
          }),
    };
  }

  async diagnosticSnapshot(): Promise<{
    definitions: number;
    attempts: number;
    activeAttempts: number;
    completedAttempts: number;
    corruptEntries: number;
  }> {
    const definitions = await this.stores.definitions.entries();
    const attempts = await this.stores.attempts.entries();
    const validAttempts = attempts.filter((entry) => validAttempt(entry.value));
    return {
      definitions: definitions.length,
      attempts: new Set(validAttempts.map((entry) => entry.value.attemptId)).size,
      activeAttempts: new Set(
        validAttempts
          .filter((entry) => entry.value.status === "active")
          .map((entry) => entry.value.attemptId),
      ).size,
      completedAttempts: new Set(
        validAttempts
          .filter((entry) => entry.value.status === "completed")
          .map((entry) => entry.value.attemptId),
      ).size,
      corruptEntries:
        definitions.filter((entry) => !validDefinition(entry.value)).length +
        attempts.filter((entry) => !validAttempt(entry.value)).length,
    };
  }
}
