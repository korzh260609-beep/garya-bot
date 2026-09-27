export type SgTurnCorrelationContext = {
  runId?: string;
  sessionKey?: string;
  channel?: string;
  messageProvider?: string;
  channelId?: string;
  accountId?: string;
  chatId?: string;
  conversationId?: string;
  to?: string;
  channelContext?: { chat?: { id?: string } };
};

export type SgTurnBillingState = "reserved" | "settled" | "unpriced" | "failed";

export type SgTurnCorrelation = {
  runId: string;
  sessionKey?: string;
  routeKey?: string;
  routeKeys: string[];
  selectedProvider?: string;
  selectedModel?: string;
  selectedModelObserved: boolean;
  differentModelObserved: boolean;
  selectedModelSucceeded: boolean;
  differentModelSucceeded: boolean;
  internalModelDepth: number;
  finalDeliveryClaimed: boolean;
  billing: Map<string, SgTurnBillingState>;
};

const MAX_TURNS = 512;

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function sgTurnRouteKeys(ctx: SgTurnCorrelationContext): string[] {
  const explicitProvider = normalized(ctx.channel ?? ctx.messageProvider);
  const deliveryProvider = ctx.conversationId ? normalized(ctx.channelId) : undefined;
  const providers = [
    ...new Set(
      [explicitProvider, deliveryProvider].filter(
        (value): value is string => typeof value === "string",
      ),
    ),
  ];
  const channelConversation =
    explicitProvider && normalized(ctx.channelId) !== explicitProvider
      ? normalized(ctx.channelId)
      : undefined;
  const conversations = [
    ...new Set(
      [
        normalized(ctx.chatId),
        normalized(ctx.conversationId),
        normalized(ctx.to),
        normalized(ctx.channelContext?.chat?.id),
        channelConversation,
      ].filter((value): value is string => typeof value === "string"),
    ),
  ];
  const accountId = normalized(ctx.accountId) ?? "default";
  return providers.flatMap((provider) =>
    conversations.map((conversation) => [provider, accountId, conversation].join("\0")),
  );
}

export function sgTurnRouteKey(ctx: SgTurnCorrelationContext): string | undefined {
  return sgTurnRouteKeys(ctx)[0];
}

export function isSgInternalRun(runId?: string, trigger?: string): boolean {
  if (trigger && trigger !== "user") {
    return true;
  }
  return /^(?:skill-workshop(?:-review)?|sg[.:-]semantic(?:-controller)?|memory|controller)(?::|-)/u.test(
    runId ?? "",
  );
}

export class SgTurnCorrelationRegistry {
  private readonly turns = new Map<string, SgTurnCorrelation>();
  private readonly sessionRuns = new Map<string, string>();
  private readonly routeRuns = new Map<string, string[]>();

  remember(params: SgTurnCorrelationContext & {
    runId: string;
    selectedProvider?: string;
    selectedModel?: string;
  }): SgTurnCorrelation {
    const existing = this.turns.get(params.runId);
    const turn: SgTurnCorrelation =
      existing ??
      {
        runId: params.runId,
        routeKeys: [],
        selectedModelObserved: false,
        differentModelObserved: false,
        selectedModelSucceeded: false,
        differentModelSucceeded: false,
        internalModelDepth: 0,
        finalDeliveryClaimed: false,
        billing: new Map<string, SgTurnBillingState>(),
      };
    const sessionKey = normalized(params.sessionKey);
    const routeKeys = sgTurnRouteKeys(params);
    if (sessionKey) {
      turn.sessionKey = sessionKey;
      this.sessionRuns.set(sessionKey, params.runId);
    }
    for (const routeKey of routeKeys) {
      if (!turn.routeKeys.includes(routeKey)) {
        turn.routeKeys.push(routeKey);
      }
      turn.routeKey ??= routeKey;
      const queue = this.routeRuns.get(routeKey) ?? [];
      if (!queue.includes(params.runId)) {
        queue.push(params.runId);
      }
      this.routeRuns.set(routeKey, queue);
    }
    if (params.selectedProvider) {
      turn.selectedProvider = params.selectedProvider;
    }
    if (params.selectedModel) {
      turn.selectedModel = params.selectedModel;
    }
    this.turns.set(params.runId, turn);
    this.prune();
    return turn;
  }

  resolve(ctx: SgTurnCorrelationContext): SgTurnCorrelation | undefined {
    const runId = normalized(ctx.runId);
    if (runId) {
      const direct = this.turns.get(runId);
      if (direct) {
        return direct;
      }
    }
    const sessionKey = normalized(ctx.sessionKey);
    const sessionRunId = sessionKey ? this.sessionRuns.get(sessionKey) : undefined;
    if (sessionRunId) {
      const sessionTurn = this.turns.get(sessionRunId);
      if (sessionTurn) {
        return sessionTurn;
      }
    }
    const candidateIds = new Set<string>();
    for (const routeKey of sgTurnRouteKeys(ctx)) {
      for (const queuedRunId of this.routeRuns.get(routeKey) ?? []) {
        candidateIds.add(queuedRunId);
      }
    }
    const active = [...candidateIds]
      .map((queuedRunId) => this.turns.get(queuedRunId))
      .filter((turn): turn is SgTurnCorrelation => Boolean(turn && !turn.finalDeliveryClaimed));
    if (active.length === 1) {
      return active[0];
    }
    if (active.length > 1) {
      return active[0];
    }
    const newest = [...candidateIds].at(-1);
    return newest ? this.turns.get(newest) : undefined;
  }

  noteModelCall(runId: string, provider: string, model: string): void {
    const turn = this.turns.get(runId);
    if (!turn || turn.internalModelDepth > 0) {
      return;
    }
    const matches = provider === turn.selectedProvider && model === turn.selectedModel;
    turn.selectedModelObserved ||= matches;
    turn.differentModelObserved ||= !matches;
  }

  noteModelCallEnded(
    runId: string,
    provider: string,
    model: string,
    outcome: "completed" | "error",
  ): void {
    const turn = this.turns.get(runId);
    if (!turn || turn.internalModelDepth > 0) {
      return;
    }
    this.noteModelCall(runId, provider, model);
    if (outcome !== "completed") {
      return;
    }
    const matches = provider === turn.selectedProvider && model === turn.selectedModel;
    turn.selectedModelSucceeded ||= matches;
    turn.differentModelSucceeded ||= !matches;
  }

  beginInternalModelWork(runId: string): void {
    const turn = this.turns.get(runId);
    if (turn) {
      turn.internalModelDepth += 1;
    }
  }

  endInternalModelWork(runId: string): void {
    const turn = this.turns.get(runId);
    if (turn) {
      turn.internalModelDepth = Math.max(0, turn.internalModelDepth - 1);
    }
  }

  shouldSuppressFalseFallback(runId: string): boolean {
    const turn = this.turns.get(runId);
    return Boolean(turn?.selectedModelSucceeded && !turn.differentModelSucceeded);
  }

  noteBilling(runId: string, callId: string, state: SgTurnBillingState): void {
    this.turns.get(runId)?.billing.set(callId, state);
  }

  claimFinalDelivery(runId: string): boolean {
    const turn = this.turns.get(runId);
    if (!turn) {
      return true;
    }
    if (turn.finalDeliveryClaimed) {
      return false;
    }
    turn.finalDeliveryClaimed = true;
    return true;
  }

  get(runId: string): SgTurnCorrelation | undefined {
    return this.turns.get(runId);
  }

  private prune(): void {
    while (this.turns.size > MAX_TURNS) {
      const oldest = this.turns.keys().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      const turn = this.turns.get(oldest);
      this.turns.delete(oldest);
      if (turn?.sessionKey && this.sessionRuns.get(turn.sessionKey) === oldest) {
        this.sessionRuns.delete(turn.sessionKey);
      }
      for (const routeKey of turn?.routeKeys ?? []) {
        const queue = (this.routeRuns.get(routeKey) ?? []).filter((id) => id !== oldest);
        if (queue.length) {
          this.routeRuns.set(routeKey, queue);
        } else {
          this.routeRuns.delete(routeKey);
        }
      }
    }
  }
}
