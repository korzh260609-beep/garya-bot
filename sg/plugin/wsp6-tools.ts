import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry, type SgWorkspace } from "./workspace-registry.js";
import {
  SgAssessmentRegistry,
  type SgAssessmentDefinition,
  type SgAssessmentDimension,
  type SgAssessmentKind,
  type SgAssessmentQuestion,
  type SgAssessmentQuestionView,
  type SgAssessmentResult,
} from "./wsp6-assessments.js";
import { Wsp6NativeLifecycle } from "./wsp6-lifecycle.js";

type ToolContext = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  messageChannel?: string;
  agentAccountId?: string;
  nativeChannelId?: string;
  requesterSenderId?: string;
  sessionKey?: string;
  deliveryContext?: { threadId?: string | number };
};

type AgentTool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<ReturnType<typeof jsonResult>>;
};

type Wsp6Actor = {
  globalId: string;
  role: "monarch" | "owner" | "admin" | "member";
};

const dimensionSchema = {
  type: "array",
  maxItems: 8,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      key: { type: "string", minLength: 1 },
      label: { type: "string", minLength: 1 },
    },
    required: ["key", "label"],
  },
} as const;

const questionSchema = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      questionId: { type: "string", minLength: 1 },
      prompt: { type: "string", minLength: 1 },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            optionId: { type: "string", minLength: 1 },
            label: { type: "string", minLength: 1 },
            points: { type: "integer", minimum: 0, maximum: 100 },
            scores: {
              type: "object",
              additionalProperties: { type: "integer", minimum: 0, maximum: 100 },
            },
          },
          required: ["optionId", "label"],
        },
      },
    },
    required: ["questionId", "prompt", "options"],
  },
} as const;

function textParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-wsp6-tool-${key}-required`);
  }
  return value.trim();
}

function dimensionsParam(value: unknown): SgAssessmentDimension[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("sg-test-dimensions-invalid");
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("sg-test-dimensions-invalid");
    }
    const item = raw as Record<string, unknown>;
    return {
      key: typeof item.key === "string" ? item.key : "",
      label: typeof item.label === "string" ? item.label : "",
    };
  });
}

function questionsParam(value: unknown): SgAssessmentQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error("sg-test-questions-invalid");
  }
  return value.map((rawQuestion) => {
    if (!rawQuestion || typeof rawQuestion !== "object") {
      throw new Error("sg-test-questions-invalid");
    }
    const question = rawQuestion as Record<string, unknown>;
    if (!Array.isArray(question.options)) {
      throw new Error("sg-test-question-options-invalid");
    }
    return {
      questionId: typeof question.questionId === "string" ? question.questionId : "",
      prompt: typeof question.prompt === "string" ? question.prompt : "",
      options: question.options.map((rawOption) => {
        if (!rawOption || typeof rawOption !== "object") {
          throw new Error("sg-test-question-options-invalid");
        }
        const option = rawOption as Record<string, unknown>;
        const rawScores = option.scores;
        const scores =
          rawScores && typeof rawScores === "object" && !Array.isArray(rawScores)
            ? Object.fromEntries(
                Object.entries(rawScores).filter((entry): entry is [string, number] =>
                  Number.isInteger(entry[1]),
                ),
              )
            : undefined;
        return {
          optionId: typeof option.optionId === "string" ? option.optionId : "",
          label: typeof option.label === "string" ? option.label : "",
          points: Number.isInteger(option.points) ? (option.points as number) : undefined,
          scores,
        };
      }),
    };
  });
}

async function actorContext(ctx: ToolContext, stateDir: string) {
  return resolveWorkspaceContext(
    {
      channel: ctx.messageChannel ?? "",
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      messageThreadId: ctx.deliveryContext?.threadId,
      senderId: ctx.requesterSenderId,
      identityLinks: ctx.config?.session?.identityLinks,
    },
    stateDir,
  );
}

async function resolveWorkspace(
  params: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof actorContext>>,
  workspaces: SgWorkspaceRegistry,
): Promise<SgWorkspace | undefined> {
  if (typeof params.workspaceId === "string" && params.workspaceId.trim()) {
    return workspaces.findById(params.workspaceId.trim());
  }
  if (!actor.channel || !actor.resourceId) {
    return undefined;
  }
  return workspaces.resolve({
    platform: actor.channel,
    ...(actor.accountId ? { accountId: actor.accountId } : {}),
    resourceId: actor.resourceId,
    ...(actor.topicId ? { topicId: actor.topicId } : {}),
  });
}

async function authorizedActor(
  actor: Awaited<ReturnType<typeof actorContext>>,
  workspace: SgWorkspace,
  memberships: SgWorkspaceMembershipRegistry,
): Promise<Wsp6Actor> {
  if (!actor.globalId) {
    throw new Error("sg-test-citizen-required");
  }
  if (workspace.status !== "active") {
    throw new Error("sg-test-workspace-not-active");
  }
  if (actor.projectRole === "monarch") {
    return { globalId: actor.globalId, role: "monarch" };
  }
  const role = await memberships.effectiveRole(workspace.workspaceId, actor.globalId);
  if (!role) {
    throw new Error("sg-test-workspace-membership-required");
  }
  return { globalId: actor.globalId, role };
}

function requireManager(actor: Wsp6Actor): void {
  if (actor.role === "member") {
    throw new Error("sg-test-manager-required");
  }
}

function definitionSummary(definition: SgAssessmentDefinition) {
  return {
    testId: definition.testId,
    workspaceId: definition.workspaceId,
    title: definition.title,
    kind: definition.kind,
    status: definition.status,
    questionCount: definition.questions.length,
    dimensions: definition.dimensions,
    createdAt: definition.createdAt,
  };
}

function pollQuestion(view: SgAssessmentQuestionView): string {
  const prefix = `[SG:${view.attemptId}:${view.questionId}] ${view.questionNumber}/${view.questionCount}. `;
  return `${prefix}${view.prompt}`.slice(0, 290);
}

function buildQuestionAction(
  actor: Awaited<ReturnType<typeof actorContext>>,
  view: SgAssessmentQuestionView,
): Record<string, unknown> {
  if (!actor.channel || !actor.senderId) {
    throw new Error("sg-test-private-route-required");
  }
  return {
    action: "poll",
    channel: actor.channel,
    target: actor.senderId,
    ...(actor.accountId ? { accountId: actor.accountId } : {}),
    pollQuestion: pollQuestion(view),
    pollOption: view.options.map((option) => option.label),
    pollMulti: false,
    ...(actor.channel.toLowerCase() === "telegram" ? { pollPublic: true } : {}),
  };
}

function formatPrivateResult(title: string, result: SgAssessmentResult): string {
  if (result.kind === "knowledge") {
    return [
      `Результат теста «${title}»`,
      `Баллы: ${result.score} из ${result.maxScore}`,
      `Результат: ${result.percent}%`,
      "Подсчёт выполнен автоматически по сохранённым ответам.",
    ].join("\n");
  }
  return [
    `Результат теста «${title}»`,
    ...result.dimensions.map(
      (dimension) =>
        `${dimension.label}: ${dimension.score} из ${dimension.maxScore} (${dimension.percent}%)`,
    ),
    "Это точные шкалы теста. Любое пояснение ИИ является только интерпретацией.",
  ].join("\n");
}

function isPrivateContext(
  actor: Awaited<ReturnType<typeof actorContext>>,
  ctx: ToolContext,
): boolean {
  if (!actor.resourceId || !actor.senderId) {
    return false;
  }
  if (ctx.sessionKey?.includes(":group:") || ctx.sessionKey?.includes(":channel:")) {
    return false;
  }
  return (
    actor.resourceId === actor.senderId || actor.resourceId === `${actor.channel}:${actor.senderId}`
  );
}

async function nativeQuestionResult(params: {
  actorContextValue: Awaited<ReturnType<typeof actorContext>>;
  question: SgAssessmentQuestionView;
  ctx: ToolContext;
  lifecycle: Wsp6NativeLifecycle;
}) {
  params.lifecycle.assertSessionAvailable(params.ctx.sessionKey);
  const nextAction = buildQuestionAction(params.actorContextValue, params.question);
  params.lifecycle.queue({
    sessionKey: params.ctx.sessionKey,
    toolName: "message",
    params: nextAction,
    purpose: params.question.questionNumber === 1 ? "first-question" : "next-question",
    successReply: "Вопрос теста отправлен в личные сообщения.",
  });
  return {
    status: "native_action_required",
    attemptId: params.question.attemptId,
    questionId: params.question.questionId,
    nextTool: "message",
    nextAction,
  };
}

async function completedResult(params: {
  definition: SgAssessmentDefinition;
  result: SgAssessmentResult;
  actorContextValue: Awaited<ReturnType<typeof actorContext>>;
  ctx: ToolContext;
  lifecycle: Wsp6NativeLifecycle;
}) {
  if (isPrivateContext(params.actorContextValue, params.ctx)) {
    return {
      status: "completed",
      result: params.result,
      deterministic: true,
      aiInterpretationAuthoritative: false,
    };
  }
  params.lifecycle.assertSessionAvailable(params.ctx.sessionKey);
  if (!params.actorContextValue.channel || !params.actorContextValue.senderId) {
    throw new Error("sg-test-private-route-required");
  }
  const nextAction = {
    action: "send",
    channel: params.actorContextValue.channel,
    target: params.actorContextValue.senderId,
    ...(params.actorContextValue.accountId
      ? { accountId: params.actorContextValue.accountId }
      : {}),
    message: formatPrivateResult(params.definition.title, params.result),
  };
  params.lifecycle.queue({
    sessionKey: params.ctx.sessionKey,
    toolName: "message",
    params: nextAction,
    purpose: "private-result",
    successReply: "Тест завершён. Личный результат отправлен в личные сообщения.",
  });
  return {
    status: "private_delivery_required",
    nextTool: "message",
    nextAction,
  };
}

export function createWsp6Tools(
  ctx: ToolContext,
  stateDir: string,
  assessments: SgAssessmentRegistry,
  lifecycle: Wsp6NativeLifecycle,
): AgentTool[] {
  const workspaces = new SgWorkspaceRegistry(stateDir);
  const memberships = new SgWorkspaceMembershipRegistry(stateDir);
  return [
    {
      name: "sg_test_manage",
      label: "Управление тестами SG",
      description:
        "Создаёт и открывает неизменяемые тесты знаний или профильные тесты. Доступно admin, owner и monarch. Для обычного опроса без индивидуального результата используй штатный message poll.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["create", "activate", "close", "get", "list"] },
          workspaceId: { type: "string", minLength: 1 },
          testId: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          kind: { type: "string", enum: ["knowledge", "profile"] },
          dimensions: dimensionSchema,
          questions: questionSchema,
        },
        required: ["action"],
      },
      async execute(_toolCallId, params) {
        try {
          const action = textParam(params, "action");
          const actorContextValue = await actorContext(ctx, stateDir);
          if (action === "create" || action === "list") {
            const workspace = await resolveWorkspace(params, actorContextValue, workspaces);
            if (!workspace) {
              return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
            }
            const actor = await authorizedActor(actorContextValue, workspace, memberships);
            requireManager(actor);
            if (action === "list") {
              const definitions = await assessments.listDefinitions(workspace.workspaceId);
              return jsonResult({ status: "ok", tests: definitions.map(definitionSummary) });
            }
            const kind = textParam(params, "kind") as SgAssessmentKind;
            const definition = await assessments.create({
              ...(typeof params.testId === "string" && params.testId.trim()
                ? { testId: params.testId.trim() }
                : {}),
              workspaceId: workspace.workspaceId,
              title: textParam(params, "title"),
              kind,
              dimensions: dimensionsParam(params.dimensions),
              questions: questionsParam(params.questions),
              actorGlobalId: actor.globalId,
            });
            return jsonResult({ status: "created", test: definitionSummary(definition) });
          }
          const definition = await assessments.findDefinition(textParam(params, "testId"));
          if (!definition) {
            throw new Error("sg-test-not-found");
          }
          const workspace = await workspaces.findById(definition.workspaceId);
          if (!workspace) {
            throw new Error("sg-test-workspace-not-found");
          }
          const actor = await authorizedActor(actorContextValue, workspace, memberships);
          requireManager(actor);
          if (action === "get") {
            return jsonResult({ status: "ok", test: definition });
          }
          if (action !== "activate" && action !== "close") {
            throw new Error("sg-test-manage-action-invalid");
          }
          const updated = await assessments.setStatus(
            definition.testId,
            action === "activate" ? "active" : "closed",
          );
          return jsonResult({ status: updated.status, test: definitionSummary(updated) });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_test_attempt",
      label: "Прохождение тестов SG",
      description:
        "Показывает доступные тесты, начинает или продолжает личную попытку и сохраняет ответ. Никогда не вычисляй результат самостоятельно. После native_action_required обязательно выполни nextAction штатным message без изменений.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["list", "start", "answer", "resume", "result"] },
          workspaceId: { type: "string", minLength: 1 },
          testId: { type: "string", minLength: 1 },
          attemptId: { type: "string", minLength: 1 },
          questionId: { type: "string", minLength: 1 },
          answer: { type: "string", minLength: 1 },
        },
        required: ["action"],
      },
      async execute(_toolCallId, params) {
        try {
          const action = textParam(params, "action");
          const actorContextValue = await actorContext(ctx, stateDir);
          if (action === "list" || action === "start") {
            const workspace = await resolveWorkspace(params, actorContextValue, workspaces);
            if (!workspace) {
              return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
            }
            const actor = await authorizedActor(actorContextValue, workspace, memberships);
            if (action === "list") {
              const definitions = await assessments.listDefinitions(workspace.workspaceId);
              return jsonResult({
                status: "ok",
                tests: definitions
                  .filter((item) => item.status === "active")
                  .map(definitionSummary),
              });
            }
            const started = await assessments.start({
              testId: textParam(params, "testId"),
              workspaceId: workspace.workspaceId,
              globalId: actor.globalId,
            });
            return jsonResult(
              await nativeQuestionResult({
                actorContextValue,
                question: started.question,
                ctx,
                lifecycle,
              }),
            );
          }
          if (!actorContextValue.globalId) {
            throw new Error("sg-test-citizen-required");
          }
          const attemptId = textParam(params, "attemptId");
          const current = await assessments.resume(attemptId, actorContextValue.globalId);
          const currentDefinition = await assessments.findDefinition(current.attempt.testId);
          if (!currentDefinition) {
            throw new Error("sg-test-not-found");
          }
          const currentWorkspace = await workspaces.findById(currentDefinition.workspaceId);
          if (!currentWorkspace) {
            throw new Error("sg-test-workspace-not-found");
          }
          await authorizedActor(actorContextValue, currentWorkspace, memberships);
          if (action === "answer") {
            const answered = await assessments.answer({
              attemptId,
              globalId: actorContextValue.globalId,
              questionId: textParam(params, "questionId"),
              answer: textParam(params, "answer"),
            });
            if (answered.status === "next") {
              return jsonResult(
                await nativeQuestionResult({
                  actorContextValue,
                  question: answered.question,
                  ctx,
                  lifecycle,
                }),
              );
            }
            return jsonResult(
              await completedResult({
                definition: currentDefinition,
                result: answered.result,
                actorContextValue,
                ctx,
                lifecycle,
              }),
            );
          }
          if (action !== "resume" && action !== "result") {
            throw new Error("sg-test-attempt-action-invalid");
          }
          const resumed = current;
          if (resumed.status === "active") {
            if (action === "result") {
              throw new Error("sg-test-attempt-not-completed");
            }
            return jsonResult(
              await nativeQuestionResult({
                actorContextValue,
                question: resumed.question,
                ctx,
                lifecycle,
              }),
            );
          }
          return jsonResult(
            await completedResult({
              definition: currentDefinition,
              result: resumed.result,
              actorContextValue,
              ctx,
              lifecycle,
            }),
          );
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_test_stats",
      label: "Статистика тестов SG",
      description:
        "Возвращает только агрегированную детерминированную статистику. До трёх разных участников подробная агрегация скрыта для защиты личных результатов. Доступно admin, owner и monarch.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { testId: { type: "string", minLength: 1 } },
        required: ["testId"],
      },
      async execute(_toolCallId, params) {
        try {
          const definition = await assessments.findDefinition(textParam(params, "testId"));
          if (!definition) {
            throw new Error("sg-test-not-found");
          }
          const workspace = await workspaces.findById(definition.workspaceId);
          if (!workspace) {
            throw new Error("sg-test-workspace-not-found");
          }
          const actor = await authorizedActor(
            await actorContext(ctx, stateDir),
            workspace,
            memberships,
          );
          requireManager(actor);
          return jsonResult({ status: "ok", stats: await assessments.stats(definition.testId) });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  ];
}

export const WSP6_AGENT_GUIDANCE = [
  "WSP6 не создаёт отдельный транспорт: обычные опросы отправляй штатным message с action=poll.",
  "Тесты знаний и профильные тесты создавай через sg_test_manage; участник проходит их только через sg_test_attempt.",
  "Каждая попытка принадлежит Global ID и workspace. Никогда не подставляй чужой Global ID и не вычисляй баллы самостоятельно.",
  "В ответ на штатное сообщение Poll response с маркером [SG:attemptId:questionId] вызови sg_test_attempt action=answer с этим attemptId, questionId и выбранной подписью ответа.",
  "После native_action_required или private_delivery_required обязательно вызови nextTool с nextAction без единого изменения.",
  "Вопросы и результаты направляются участнику лично. В общей группе сообщай только факт отправки, не раскрывая ответов, баллов или профильных шкал.",
  "Точные баллы и шкалы выдаёт реестр WSP6. Любая интерпретация ИИ не является результатом теста.",
].join("\n");
