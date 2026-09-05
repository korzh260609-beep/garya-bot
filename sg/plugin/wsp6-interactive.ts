import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceRegistry, type SgWorkspace } from "./workspace-registry.js";
import {
  assessmentInteractiveToken,
  SgAssessmentRegistry,
  type SgAssessmentDefinition,
  type SgAssessmentQuestionView,
  type SgAssessmentResult,
} from "./wsp6-assessments.js";

export const WSP6_CALLBACK_NAMESPACE = "sg6";
const PORTABLE_CALLBACK_MAX_BYTES = 52;
const ATTEMPT_PATTERN = /^att_[a-f0-9]{32}$/u;

type TelegramButtons = Array<
  Array<{ text: string; callback_data: string; style?: "danger" | "success" | "primary" }>
>;

type TelegramInteractiveContext = {
  channel: "telegram";
  accountId: string;
  senderId?: string;
  threadId?: number;
  isGroup: boolean;
  auth: { isAuthorizedSender: boolean };
  callback: { namespace: string; payload: string; chatId: string };
  respond: {
    reply(params: { text: string; buttons?: TelegramButtons }): Promise<void>;
    editMessage(params: { text: string; buttons?: TelegramButtons }): Promise<void>;
  };
};

type InteractiveApi = {
  config?: OpenClawPluginApi["config"];
  registerInteractiveHandler: OpenClawPluginApi["registerInteractiveHandler"];
  loadOutboundAdapter: OpenClawPluginApi["runtime"]["channel"]["outbound"]["loadAdapter"];
  logger?: { info(message: string): void; warn(message: string): void };
};

export type Wsp6InteractiveSnapshot = {
  registered: boolean;
  callbacks: number;
  started: number;
  answered: number;
  completed: number;
  failed: number;
};

function callbackValue(payload: string): string {
  const value = `${WSP6_CALLBACK_NAMESPACE}:${payload}`;
  if (Buffer.byteLength(value, "utf8") > PORTABLE_CALLBACK_MAX_BYTES) {
    throw new Error("sg-test-callback-too-long");
  }
  return value;
}

function parseIndex(value: string): number {
  if (!/^[0-9a-z]{1,2}$/u.test(value)) {
    throw new Error("sg-test-callback-invalid");
  }
  return Number.parseInt(value, 36);
}

function questionPayload(attemptId: string, questionIndex: number, optionIndex: number): string {
  if (!ATTEMPT_PATTERN.test(attemptId)) {
    throw new Error("sg-test-attempt-id-invalid");
  }
  return `a:${attemptId}:${questionIndex.toString(36)}:${optionIndex.toString(36)}`;
}

function optionLabel(label: string, optionIndex: number): string {
  return `${String.fromCharCode(65 + optionIndex)}. ${label}`;
}

export function wsp6StartCallbackValue(
  definition: Pick<SgAssessmentDefinition, "workspaceId" | "testId">,
): string {
  return callbackValue(`s:${assessmentInteractiveToken(definition)}`);
}

export function wsp6QuestionText(view: SgAssessmentQuestionView): string {
  return [
    `🧩 ${view.title}`,
    `Вопрос ${view.questionNumber}/${view.questionCount}`,
    view.prompt,
  ].join("\n\n");
}

export function wsp6QuestionPresentation(view: SgAssessmentQuestionView) {
  const questionIndex = view.questionNumber - 1;
  return {
    blocks: [
      {
        type: "buttons",
        buttons: view.options.map((option, optionIndex) => ({
          label: optionLabel(option.label, optionIndex),
          action: {
            type: "callback",
            value: callbackValue(questionPayload(view.attemptId, questionIndex, optionIndex)),
          },
        })),
      },
    ],
  };
}

function questionButtons(view: SgAssessmentQuestionView): TelegramButtons {
  const questionIndex = view.questionNumber - 1;
  return view.options.map((option, optionIndex) => [
    {
      text: optionLabel(option.label, optionIndex),
      callback_data: callbackValue(questionPayload(view.attemptId, questionIndex, optionIndex)),
    },
  ]);
}

export function formatWsp6PrivateResult(title: string, result: SgAssessmentResult): string {
  if (result.kind === "knowledge") {
    return [
      `Результат теста «${title}»`,
      `Баллы: ${result.score} из ${result.maxScore}`,
      `Результат: ${result.percent}%`,
      "Подсчёт выполнен автоматически по сохранённым ответам.",
    ].join("\n");
  }
  if (result.mode === "categories") {
    const profiles = result.profiles.length
      ? result.profiles
      : result.keys.map((key) => ({ key, title: key, description: "" }));
    return [
      `Результат теста «${title}»`,
      "Результат:",
      ...profiles.map(
        (profile) => `• ${profile.title}${profile.description ? ` — ${profile.description}` : ""}`,
      ),
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

function asTelegramContext(value: unknown): TelegramInteractiveContext {
  if (!value || typeof value !== "object") {
    throw new Error("sg-test-callback-context-invalid");
  }
  const context = value as Partial<TelegramInteractiveContext>;
  if (
    context.channel !== "telegram" ||
    typeof context.accountId !== "string" ||
    typeof context.isGroup !== "boolean" ||
    !context.auth ||
    typeof context.auth.isAuthorizedSender !== "boolean" ||
    !context.callback ||
    context.callback.namespace !== WSP6_CALLBACK_NAMESPACE ||
    typeof context.callback.payload !== "string" ||
    typeof context.callback.chatId !== "string" ||
    !context.respond ||
    typeof context.respond.reply !== "function" ||
    typeof context.respond.editMessage !== "function"
  ) {
    throw new Error("sg-test-callback-context-invalid");
  }
  return context as TelegramInteractiveContext;
}

function callbackMatchesWorkspace(
  ctx: TelegramInteractiveContext,
  workspace: SgWorkspace,
): boolean {
  if (!ctx.isGroup) {
    return true;
  }
  const resourceIds = new Set([
    ctx.callback.chatId,
    `telegram:${ctx.callback.chatId}`,
    `telegram:group:${ctx.callback.chatId}`,
  ]);
  const accountMatches = !workspace.accountId || workspace.accountId === ctx.accountId;
  const topicMatches =
    workspace.topicId === undefined || workspace.topicId === String(ctx.threadId ?? "");
  return (
    workspace.platform.toLowerCase() === "telegram" &&
    accountMatches &&
    topicMatches &&
    resourceIds.has(workspace.resourceId)
  );
}

function safeError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "sg-test-attempt-owner-required") {
    return "Эта кнопка относится к попытке другого участника.";
  }
  if (code.includes("citizen") || code.includes("authorized")) {
    return "У вас нет доступа к этому тесту.";
  }
  if (code.includes("not-active") || code.includes("closed") || code.includes("not-found")) {
    return "Этот тест сейчас недоступен.";
  }
  if (code.includes("out-of-order") || code.includes("callback")) {
    return "Эта кнопка уже устарела. Используйте кнопки в последнем вопросе.";
  }
  return "Не удалось обработать нажатие. Попробуйте ещё раз.";
}

export class Wsp6InteractiveController {
  private readonly workspaces: SgWorkspaceRegistry;
  private readonly counters = { callbacks: 0, started: 0, answered: 0, completed: 0, failed: 0 };
  private registered = false;

  constructor(
    private readonly stateDir: string,
    private readonly resolveAssessments: () => SgAssessmentRegistry,
    private readonly api: InteractiveApi,
  ) {
    this.workspaces = new SgWorkspaceRegistry(stateDir);
  }

  snapshot(): Wsp6InteractiveSnapshot {
    return { registered: this.registered, ...this.counters };
  }

  register(): void {
    this.api.registerInteractiveHandler({
      channel: "telegram",
      namespace: WSP6_CALLBACK_NAMESPACE,
      handler: async (rawContext: unknown) => {
        this.counters.callbacks += 1;
        let ctx: TelegramInteractiveContext | undefined;
        try {
          ctx = asTelegramContext(rawContext);
          await this.handle(ctx);
        } catch (error) {
          this.counters.failed += 1;
          this.api.logger?.warn(`[sg-wsp6] stage=callback-failed reason=${safeError(error)}`);
          if (ctx) {
            try {
              await ctx.respond.reply({ text: safeError(error) });
            } catch {
              // Telegram already owns delivery diagnostics for callback replies.
            }
          }
        }
        return { handled: true };
      },
    });
    this.registered = true;
  }

  private async authorizedGlobalId(
    ctx: TelegramInteractiveContext,
    workspace: SgWorkspace,
  ): Promise<string> {
    if (!ctx.auth.isAuthorizedSender || !ctx.senderId?.trim()) {
      throw new Error("sg-test-callback-sender-not-authorized");
    }
    if (workspace.status !== "active") {
      throw new Error("sg-test-workspace-not-active");
    }
    if (!callbackMatchesWorkspace(ctx, workspace)) {
      throw new Error("sg-test-callback-workspace-mismatch");
    }
    const actor = await resolveWorkspaceContext(
      {
        channel: "telegram",
        accountId: ctx.accountId,
        senderId: ctx.senderId,
        identityLinks: this.api.config?.session?.identityLinks,
      },
      this.stateDir,
    );
    if (!actor.globalId) {
      throw new Error("sg-test-citizen-required");
    }
    return actor.globalId;
  }

  private async handle(ctx: TelegramInteractiveContext): Promise<void> {
    const parts = ctx.callback.payload.split(":");
    if (parts[0] === "s" && parts.length === 2) {
      await this.start(ctx, parts[1] ?? "");
      return;
    }
    if (parts[0] === "a" && parts.length === 4) {
      await this.answer(
        ctx,
        parts[1] ?? "",
        parseIndex(parts[2] ?? ""),
        parseIndex(parts[3] ?? ""),
      );
      return;
    }
    if (parts[0] === "r" && parts.length === 2) {
      await this.retryResult(ctx, parts[1] ?? "");
      return;
    }
    throw new Error("sg-test-callback-invalid");
  }

  private async start(ctx: TelegramInteractiveContext, token: string): Promise<void> {
    const assessments = this.resolveAssessments();
    const definition = await assessments.findDefinitionByInteractiveToken(token);
    if (!definition || definition.status !== "active") {
      throw new Error("sg-test-not-active");
    }
    const workspace = await this.workspaces.findById(definition.workspaceId);
    if (!workspace) {
      throw new Error("sg-test-workspace-not-found");
    }
    const globalId = await this.authorizedGlobalId(ctx, workspace);
    const started = await assessments.start({
      testId: definition.testId,
      workspaceId: workspace.workspaceId,
      globalId,
    });
    await ctx.respond.reply({
      text: wsp6QuestionText(started.question),
      buttons: questionButtons(started.question),
    });
    this.counters.started += 1;
  }

  private async answer(
    ctx: TelegramInteractiveContext,
    attemptId: string,
    questionIndex: number,
    optionIndex: number,
  ): Promise<void> {
    if (!ATTEMPT_PATTERN.test(attemptId)) {
      throw new Error("sg-test-callback-invalid");
    }
    const identity = await resolveWorkspaceContext(
      {
        channel: "telegram",
        accountId: ctx.accountId,
        senderId: ctx.senderId,
        identityLinks: this.api.config?.session?.identityLinks,
      },
      this.stateDir,
    );
    if (!ctx.auth.isAuthorizedSender || !identity.globalId) {
      throw new Error("sg-test-citizen-required");
    }
    const assessments = this.resolveAssessments();
    const current = await assessments.resume(attemptId, identity.globalId);
    const definition = await assessments.findDefinition(current.attempt.testId);
    const workspace = definition && (await this.workspaces.findById(definition.workspaceId));
    if (!definition || !workspace) {
      throw new Error("sg-test-workspace-not-found");
    }
    await this.authorizedGlobalId(ctx, workspace);
    if (current.status === "completed") {
      await this.finish(ctx, definition, current.attempt.attemptId, current.result);
      return;
    }
    const currentIndex = current.question.questionNumber - 1;
    if (questionIndex < currentIndex) {
      await ctx.respond.editMessage({
        text: wsp6QuestionText(current.question),
        buttons: questionButtons(current.question),
      });
      return;
    }
    if (questionIndex !== currentIndex) {
      throw new Error("sg-test-answer-out-of-order");
    }
    const option = current.question.options[optionIndex];
    if (!option) {
      throw new Error("sg-test-callback-invalid");
    }
    const answered = await assessments.answer({
      attemptId,
      globalId: identity.globalId,
      questionId: current.question.questionId,
      answer: option.optionId,
    });
    this.counters.answered += 1;
    if (answered.status === "next") {
      await ctx.respond.editMessage({
        text: wsp6QuestionText(answered.question),
        buttons: questionButtons(answered.question),
      });
      return;
    }
    await this.finish(ctx, definition, answered.attempt.attemptId, answered.result);
  }

  private async retryResult(ctx: TelegramInteractiveContext, attemptId: string): Promise<void> {
    if (!ATTEMPT_PATTERN.test(attemptId)) {
      throw new Error("sg-test-callback-invalid");
    }
    const identity = await resolveWorkspaceContext(
      {
        channel: "telegram",
        accountId: ctx.accountId,
        senderId: ctx.senderId,
        identityLinks: this.api.config?.session?.identityLinks,
      },
      this.stateDir,
    );
    if (!identity.globalId) {
      throw new Error("sg-test-citizen-required");
    }
    const assessments = this.resolveAssessments();
    const current = await assessments.resume(attemptId, identity.globalId);
    const definition = await assessments.findDefinition(current.attempt.testId);
    const workspace = definition && (await this.workspaces.findById(definition.workspaceId));
    if (!definition || !workspace) {
      throw new Error("sg-test-workspace-not-found");
    }
    await this.authorizedGlobalId(ctx, workspace);
    if (current.status === "active") {
      await ctx.respond.editMessage({
        text: wsp6QuestionText(current.question),
        buttons: questionButtons(current.question),
      });
      return;
    }
    await this.finish(ctx, definition, current.attempt.attemptId, current.result);
  }

  private async finish(
    ctx: TelegramInteractiveContext,
    definition: SgAssessmentDefinition,
    attemptId: string,
    result: SgAssessmentResult,
  ): Promise<void> {
    const resultText = formatWsp6PrivateResult(definition.title, result);
    if (!ctx.isGroup) {
      await ctx.respond.editMessage({ text: resultText, buttons: [] });
      this.counters.completed += 1;
      return;
    }
    const delivered = await this.sendPrivateResult(ctx, resultText);
    await ctx.respond.editMessage(
      delivered
        ? { text: "Тест завершён. Личный результат отправлен в личные сообщения.", buttons: [] }
        : {
            text: "Тест завершён, результат сохранён. Откройте личный чат с ботом и повторите отправку.",
            buttons: [
              [
                {
                  text: "Отправить результат в личку",
                  callback_data: callbackValue(`r:${attemptId}`),
                },
              ],
            ],
          },
    );
    if (delivered) {
      this.counters.completed += 1;
    }
  }

  private async sendPrivateResult(
    ctx: TelegramInteractiveContext,
    resultText: string,
  ): Promise<boolean> {
    if (!ctx.senderId || !this.api.config) {
      return false;
    }
    try {
      const adapter = await this.api.loadOutboundAdapter("telegram");
      if (!adapter?.sendText) {
        return false;
      }
      await adapter.sendText({
        cfg: this.api.config,
        to: ctx.senderId,
        text: resultText,
        accountId: ctx.accountId,
      });
      return true;
    } catch {
      return false;
    }
  }
}
