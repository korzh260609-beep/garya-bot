export type SgTurnCorrelationContext = {
  runId?: string;
  sessionKey?: string;
  channel?: string;
  messageProvider?: string;
  channelId?: string;
  accountId?: string;
  chatId?: string;
  conversationId?: string;
};

export type SgTurnBillingState = "reserved" | "settled" | "unpriced" | "failed";

export type SgTurnCorrelation = {
  runId: string;
  sessionKey?: string;
  routeKey?: string;
  selectedProvider?: string;
  selectedModel?: string;
  selectedModelObserved: boolean;
  differentModelObserved: boolean;
  finalDeliveryClaimed: boolean;
  billing: Map<string, SgTurnBillingState>;
};

const MAX_TURNS = 512;

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function sgTurnRouteKey(ctx: SgTurnCorrelationContext): string | undefined {
  const channel = normalized(ctx.channel ?? ctx.messageProvider);
  const conversation = normalized(
    ctx.chatId ?? ctx.conversationId ?? (channel ? ctx.channelId : undefined),
  );
  const provider = channel ?? (ctx.conversationId ? normalized(ctx.channelId) : undefined);
  if (!provider || !conversation) {
    return undefined;
  }
  return [provider, normalized(ctx.accountId) ?? "default", conversation].join("\0");
}

export function isSgInternalRun(runId?: string, trigger?: string): boolean {
  if (trigger && trigger !== "user") {
    return true;
  }
  return /^(?:skill-workshop-review|sg-semantic-controller|memory|controller):/u.test(runId ?? "");
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
        selectedModelObserved: false,
        differentModelObserved: false,
        finalDeliveryClaimed: false,
        billing: new Map<string, SgTurnBillingState>(),
      };
    const sessionKey = normalized(params.sessionKey);
    const routeKey = sgTurnRouteKey(params);
    if (sessionKey) {
      turn.sessionKey = sessionKey;
      this.sessionRuns.set(sessionKey, params.runId);
    }
    if (routeKey) {
      turn.routeKey = routeKey;
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
    const routeKey = sgTurnRouteKey(ctx);
    const queue = routeKey ? this.routeRuns.get(routeKey) : undefined;
    if (!queue?.length) {
      return undefined;
    }
    for (const queuedRunId of queue) {
      const turn = this.turns.get(queuedRunId);
      if (turn && !turn.finalDeliveryClaimed) {
        return turn;
      }
    }
    return this.turns.get(queue[queue.length - 1]!);
  }

  noteModelCall(runId: string, provider: string, model: string): void {
    const turn = this.turns.get(runId);
    if (!turn) {
      return;
    }
    const matches = provider === turn.selectedProvider && model === turn.selectedModel;
    turn.selectedModelObserved ||= matches;
    turn.differentModelObserved ||= !matches;
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
      if (turn?.routeKey) {
        const queue = (this.routeRuns.get(turn.routeKey) ?? []).filter((id) => id !== oldest);
        if (queue.length) {
          this.routeRuns.set(turn.routeKey, queue);
        } else {
          this.routeRuns.delete(turn.routeKey);
        }
      }
    }
  }
}
