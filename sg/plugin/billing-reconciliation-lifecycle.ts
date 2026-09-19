import { reconcileOpenAiBilling } from "./billing-openai-reconciliation.js";

const RECONCILIATION_INTERVAL_MS = 6 * 60 * 60 * 1_000;

type ReconciliationLifecycleApi = {
  on(event: "gateway_start" | "gateway_stop", handler: () => void | Promise<void>): void;
  logger?: { info(message: string): void; warn(message: string): void };
};

type IntervalHandle = ReturnType<typeof setInterval>;

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "sg-billing-admin-usage-unavailable";
  return /^sg-billing-[a-z0-9-]+$/u.test(message) ? message : "sg-billing-admin-usage-unavailable";
}

export function registerSgBillingReconciliation(params: {
  api: ReconciliationLifecycleApi;
  stateDir: string;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}): void {
  const env = params.env ?? process.env;
  const setIntervalFn = params.setIntervalFn ?? setInterval;
  const clearIntervalFn = params.clearIntervalFn ?? clearInterval;
  let timer: IntervalHandle | undefined;
  let running = false;

  const reconcile = async (trigger: "startup" | "periodic") => {
    if (!env.OPENAI_ADMIN_KEY?.trim() || !env.OPENAI_PROJECT_ID?.trim() || running) {
      return;
    }
    running = true;
    try {
      const result = await reconcileOpenAiBilling({
        stateDir: params.stateDir,
        env,
        ...(params.fetchFn ? { fetchFn: params.fetchFn } : {}),
        ...(params.now ? { now: params.now() } : {}),
      });
      params.api.logger?.info(
        `[sg-billing] reconciliation ${trigger} complete: windows=${result.windowCount}`,
      );
    } catch (error) {
      params.api.logger?.warn(
        `[sg-billing] reconciliation ${trigger} failed safely: ${safeErrorCode(error)}`,
      );
    } finally {
      running = false;
    }
  };

  params.api.on("gateway_start", () => {
    void reconcile("startup");
    if (!timer) {
      timer = setIntervalFn(() => void reconcile("periodic"), RECONCILIATION_INTERVAL_MS);
      timer.unref?.();
    }
  });
  params.api.on("gateway_stop", () => {
    if (timer) {
      clearIntervalFn(timer);
      timer = undefined;
    }
  });
}
