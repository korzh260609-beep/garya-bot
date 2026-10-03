import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { issueDeviceBootstrapToken, listDevicePairing } from "openclaw/plugin-sdk/device-bootstrap";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";
import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  PluginCommandContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import type { loadCronStore } from "openclaw/plugin-sdk/cron-store-runtime";

type CronStoreFile = Awaited<ReturnType<typeof loadCronStore>>;
import { resolveSgCanonicalIdentity, resolveWorkspaceContext } from "./context.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

export const SG_DEVICE_TOOL_NAMES = ["sg_device"] as const;

const DEVICE_IDENTITY_PREFIX = "device:openclaw:";
const PAIRING_NAMESPACE = "sg-device-pairing";
const PAIRING_KEY = "active";
const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_CLOCK_SKEW_MS = 5_000;

type PairingSnapshot = Awaited<ReturnType<typeof listDevicePairing>>;
type PairedDevice = PairingSnapshot["paired"][number];

type SgPairingSession = {
  globalId: string;
  issuedAtMs: number;
  expiresAtMs: number;
  baselineDeviceIds: string[];
  candidateDeviceId?: string;
};

type PairingStore = {
  register(key: string, value: SgPairingSession, opts?: { ttlMs?: number }): Promise<void>;
  registerIfAbsent(
    key: string,
    value: SgPairingSession,
    opts?: { ttlMs?: number },
  ): Promise<boolean>;
  lookup(key: string): Promise<SgPairingSession | undefined>;
  delete(key: string): Promise<boolean>;
};

type SgDeviceApi = {
  config?: OpenClawPluginApi["config"];
  runtime: {
    version?: string;
    nodes?: Pick<OpenClawPluginApi["runtime"]["nodes"], "list">;
  };
  on: OpenClawPluginApi["on"];
  runContext?: OpenClawPluginApi["runContext"];
  logger?: Pick<OpenClawPluginApi["logger"], "info">;
};

export type SgDeviceAccessDeps = {
  now(): number;
  listPairing(stateDir: string): Promise<PairingSnapshot>;
  issueNodeBootstrap(stateDir: string): Promise<{ token: string; expiresAtMs: number }>;
};

const defaultDeps: SgDeviceAccessDeps = {
  now: () => Date.now(),
  listPairing: (stateDir) => listDevicePairing(stateDir),
  issueNodeBootstrap: (stateDir) =>
    issueDeviceBootstrapToken({
      baseDir: stateDir,
      roles: ["node"],
      scopes: [],
    }),
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDeviceId(value: string): string {
  return value.trim().toLowerCase();
}

export function canonicalSgDeviceIdentity(deviceId: string): string {
  const normalized = normalizeDeviceId(deviceId);
  if (!normalized) throw new Error("sg-device-id-required");
  return `${DEVICE_IDENTITY_PREFIX}${normalized}`;
}

function pendingNodeApprovalRequestId(device: PairedDevice): string | undefined {
  return clean(device.pendingNodeSurface?.requestId) || undefined;
}

function deviceRoles(device: { role?: string; roles?: string[] }): string[] {
  const out = new Set<string>();
  const primary = clean(device.role).toLowerCase();
  if (primary) out.add(primary);
  for (const role of device.roles ?? []) {
    const normalized = clean(role).toLowerCase();
    if (normalized) out.add(normalized);
  }
  return [...out];
}

function isNodeOnlyBootstrapDevice(device: PairedDevice, session: SgPairingSession): boolean {
  const roles = deviceRoles(device);
  const scopes = Array.isArray(device.scopes)
    ? device.scopes.map((scope) => clean(scope)).filter(Boolean)
    : [];
  return (
    !session.baselineDeviceIds.includes(device.deviceId) &&
    device.approvedVia === "bootstrap" &&
    roles.length === 1 &&
    roles[0] === "node" &&
    scopes.length === 0 &&
    device.approvedAtMs >= session.issuedAtMs - PAIRING_CLOCK_SKEW_MS
  );
}

function resolveGatewayUrl(config: OpenClawPluginApi["config"] | undefined): string {
  const pluginConfig = config?.plugins?.entries?.["device-pair"]?.config;
  const configuredPublicUrl =
    pluginConfig && typeof pluginConfig === "object" && !Array.isArray(pluginConfig)
      ? clean((pluginConfig as Record<string, unknown>).publicUrl)
      : "";
  const raw =
    configuredPublicUrl ||
    clean(config?.gateway?.publicOrigin) ||
    clean(config?.gateway?.remote?.url);
  if (!raw) throw new Error("sg-device-public-gateway-url-required");

  const url = new URL(raw);
  if (url.username || url.password) throw new Error("sg-device-public-gateway-url-invalid");
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol !== "wss:" && url.protocol !== "ws:") {
    throw new Error("sg-device-public-gateway-url-invalid");
  }
  url.search = "";
  url.hash = "";
  if (url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/$/u, "");
}

function encodeSetupCode(input: {
  gatewayUrl: string;
  token: string;
  expiresAtMs: number;
}): string {
  return Buffer.from(
    JSON.stringify({
      url: input.gatewayUrl,
      bootstrapToken: input.token,
      expiresAtMs: input.expiresAtMs,
    }),
    "utf8",
  ).toString("base64url");
}

function openPairingStore(stateDir: string, now: () => number): PairingStore {
  const file = path.join(stateDir, "sg", `${PAIRING_NAMESPACE}.json`);
  const lock = <T>(work: () => Promise<T>) =>
    withFileLock(
      file,
      {
        retries: { retries: 50, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
        stale: 30_000,
        staleRecovery: "fail-closed",
      },
      work,
    );
  const read = async (): Promise<SgPairingSession | undefined> => {
    const result = await readJsonFileWithFallback<SgPairingSession | null>(file, null);
    const value = result.value;
    return value && value.expiresAtMs > now() ? value : undefined;
  };
  return {
    register: async (_key, value) => lock(() => writeJsonFileAtomically(file, value)),
    registerIfAbsent: async (_key, value) =>
      lock(async () => {
        if (await read()) return false;
        await writeJsonFileAtomically(file, value);
        return true;
      }),
    lookup: async () => read(),
    delete: async () =>
      lock(async () => {
        if (!(await read())) return false;
        await unlink(file);
        return true;
      }),
  };
}

async function resolveToolGlobalId(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
): Promise<string> {
  const channel = clean(ctx.messageChannel);
  const senderId = clean(ctx.requesterSenderId);
  if (!channel || !senderId) throw new Error("sg-device-requester-required");
  const actor = await resolveWorkspaceContext(
    {
      channel,
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      senderId,
      identityLinks: ctx.config?.session?.identityLinks,
    },
    stateDir,
  );
  if (!actor.globalId) throw new Error("sg-device-global-id-required");
  return actor.globalId;
}

async function requesterGlobalId(
  api: SgDeviceApi,
  stateDir: string,
  ctx: { requester?: { channel?: string; senderId?: string } },
): Promise<string | undefined> {
  const channel = clean(ctx.requester?.channel);
  const senderId = clean(ctx.requester?.senderId);
  if (!channel || !senderId) return undefined;
  const canonical = resolveSgCanonicalIdentity({
    channel,
    senderId,
    identityLinks: api.config?.session?.identityLinks,
  });
  if (!canonical) return undefined;
  return (await new SgGlobalProfileRegistry(stateDir).ensureProfile(canonical)).globalId;
}

async function ownedDeviceIds(
  registry: SgGlobalProfileRegistry,
  globalId: string,
): Promise<Set<string>> {
  const snapshot = await registry.snapshot();
  return new Set(
    snapshot.identities.flatMap((identity) =>
      identity.globalId === globalId &&
      identity.canonicalIdentity.startsWith(DEVICE_IDENTITY_PREFIX)
        ? [identity.canonicalIdentity.slice(DEVICE_IDENTITY_PREFIX.length)]
        : [],
    ),
  );
}

async function deviceOwner(
  registry: SgGlobalProfileRegistry,
  deviceId: string,
): Promise<string | undefined> {
  return (await registry.findByCanonicalIdentity(canonicalSgDeviceIdentity(deviceId)))?.globalId;
}

async function beginPairing(params: {
  api: SgDeviceApi;
  globalId: string;
  stateDir: string;
  deps: SgDeviceAccessDeps;
}) {
  const store = openPairingStore(params.stateDir, params.deps.now);
  const snapshot = await params.deps.listPairing(params.stateDir);
  const issuedAtMs = params.deps.now();
  const session: SgPairingSession = {
    globalId: params.globalId,
    issuedAtMs,
    expiresAtMs: issuedAtMs + PAIRING_TTL_MS,
    baselineDeviceIds: snapshot.paired.map((device) => device.deviceId),
  };
  const acquired = await store.registerIfAbsent(PAIRING_KEY, session, {
    ttlMs: PAIRING_TTL_MS,
  });
  if (!acquired) {
    const active = await store.lookup(PAIRING_KEY);
    return {
      status: "busy" as const,
      owner: active?.globalId === params.globalId ? "self" : "another-user",
      expiresAtMs: active?.expiresAtMs,
    };
  }

  try {
    const gatewayUrl = resolveGatewayUrl(params.api.config);
    const issued = await params.deps.issueNodeBootstrap(params.stateDir);
    await store.register(
      PAIRING_KEY,
      { ...session, expiresAtMs: issued.expiresAtMs },
      { ttlMs: Math.max(1_000, issued.expiresAtMs - params.deps.now()) },
    );
    const setupCode = encodeSetupCode({
      gatewayUrl,
      token: issued.token,
      expiresAtMs: issued.expiresAtMs,
    });
    return {
      status: "ready" as const,
      expiresAtMs: issued.expiresAtMs,
      command: `openclaw connect "oc-pair://${setupCode}" --service`,
    };
  } catch (error) {
    await store.delete(PAIRING_KEY).catch(() => false);
    throw error;
  }
}

async function finishPairing(params: {
  api: SgDeviceApi;
  registry: SgGlobalProfileRegistry;
  globalId: string;
  stateDir: string;
  deps: SgDeviceAccessDeps;
}) {
  const store = openPairingStore(params.stateDir, params.deps.now);
  const session = await store.lookup(PAIRING_KEY);
  if (!session) return { status: "no-active-pairing" };
  if (session.globalId !== params.globalId) {
    return { status: "busy", owner: "another-user", expiresAtMs: session.expiresAtMs };
  }
  const snapshot = await params.deps.listPairing(params.stateDir);
  const candidates: PairedDevice[] = [];
  for (const device of snapshot.paired) {
    if (!isNodeOnlyBootstrapDevice(device, session)) continue;
    const owner = await deviceOwner(params.registry, device.deviceId);
    if (!owner || owner === params.globalId) candidates.push(device);
  }
  if (candidates.length === 0) {
    return { status: "waiting", expiresAtMs: session.expiresAtMs };
  }
  if (candidates.length > 1) {
    return { status: "ambiguous", candidateCount: candidates.length };
  }
  const device = candidates[0]!;
  await store.register(
    PAIRING_KEY,
    { ...session, candidateDeviceId: device.deviceId },
    { ttlMs: Math.max(1_000, session.expiresAtMs - params.deps.now()) },
  );
  return {
    status: "confirmation-required",
    deviceId: device.deviceId,
    name:
      clean(device.operatorLabel) ||
      clean(device.nodeSurface?.displayName) ||
      clean(device.displayName) ||
      device.deviceId,
    platform: clean(device.platform) || undefined,
    nodeApprovalRequestId: pendingNodeApprovalRequestId(device),
  };
}

async function confirmPairing(params: {
  api: SgDeviceApi;
  registry: SgGlobalProfileRegistry;
  globalId: string;
  stateDir: string;
  deps: SgDeviceAccessDeps;
}) {
  const store = openPairingStore(params.stateDir, params.deps.now);
  const session = await store.lookup(PAIRING_KEY);
  if (!session) return { status: "no-active-pairing" };
  if (session.globalId !== params.globalId) {
    return { status: "busy", owner: "another-user", expiresAtMs: session.expiresAtMs };
  }
  if (!session.candidateDeviceId) return { status: "finish-required" };

  const snapshot = await params.deps.listPairing(params.stateDir);
  const device = snapshot.paired.find(
    (candidate) =>
      normalizeDeviceId(candidate.deviceId) === normalizeDeviceId(session.candidateDeviceId!) &&
      isNodeOnlyBootstrapDevice(candidate, session),
  );
  if (!device) return { status: "pairing-changed" };

  const owner = await deviceOwner(params.registry, device.deviceId);
  if (owner && owner !== params.globalId) return { status: "ownership-conflict" };

  await params.registry.linkIdentity(params.globalId, canonicalSgDeviceIdentity(device.deviceId));
  await store.delete(PAIRING_KEY);
  return {
    status: "paired",
    deviceId: device.deviceId,
    name:
      clean(device.operatorLabel) ||
      clean(device.nodeSurface?.displayName) ||
      clean(device.displayName) ||
      device.deviceId,
    platform: clean(device.platform) || undefined,
    nodeApprovalRequestId: pendingNodeApprovalRequestId(device),
  };
}

async function listOwnedDevices(params: {
  api: SgDeviceApi;
  registry: SgGlobalProfileRegistry;
  globalId: string;
  stateDir: string;
  deps: SgDeviceAccessDeps;
}) {
  const [snapshot, owned, runtime] = await Promise.all([
    params.deps.listPairing(params.stateDir),
    ownedDeviceIds(params.registry, params.globalId),
    params.api.runtime.nodes?.list({}).catch(() => ({ nodes: [] })) ??
      Promise.resolve({ nodes: [] }),
  ]);
  return snapshot.paired
    .filter((device) => owned.has(normalizeDeviceId(device.deviceId)))
    .map((device) => {
      const node = runtime.nodes.find(
        (candidate) => normalizeDeviceId(candidate.nodeId) === normalizeDeviceId(device.deviceId),
      );
      return {
        deviceId: device.deviceId,
        name:
          clean(device.operatorLabel) ||
          clean(device.nodeSurface?.displayName) ||
          clean(device.displayName) ||
          device.deviceId,
        platform: clean(device.platform) || undefined,
        connected: node?.connected === true,
        caps: node?.caps ?? device.nodeSurface?.caps ?? [],
        commands: node?.commands ?? device.nodeSurface?.commands ?? [],
        nodeApprovalRequestId: pendingNodeApprovalRequestId(device),
      };
    });
}

export function registerSgDeviceCommand(
  api: SgDeviceApi & Pick<OpenClawPluginApi, "registerCommand">,
  stateDir: string,
  deps: SgDeviceAccessDeps = defaultDeps,
): void {
  api.registerCommand({
    name: "sg_connect",
    description: "Подключить личное устройство к SG",
    requireAuth: true,
    handler: async (ctx: PluginCommandContext) => {
      const senderId = clean(ctx.senderId);
      const channel = clean(ctx.channel);
      const peer = `${channel}:${senderId}`;
      // Native peer routes identify a DM; shared routes have a different From.
      // Native slash commands use slash:<sender> for To. Unknown routes fail closed.
      const privateRoute =
        channel &&
        senderId &&
        ctx.from === peer &&
        (ctx.to === peer || ctx.to === `slash:${senderId}`) &&
        !ctx.threadParentId;
      if (!ctx.isAuthorizedSender || !privateRoute) {
        return {
          text: "Не удалось подтвердить личный чат. Выполни /sg_connect в личном чате с SG.",
        };
      }
      try {
        const actor = await resolveWorkspaceContext(
          {
            channel,
            senderId,
            accountId: ctx.accountId,
            to: ctx.to,
            identityLinks: ctx.config.session?.identityLinks,
          },
          stateDir,
        );
        if (!actor.globalId) {
          return { text: "Не удалось определить Global ID. Подключение не начато." };
        }
        const result = await beginPairing({ api, globalId: actor.globalId, stateDir, deps });
        if (result.status === "busy") {
          return {
            text: "Подключение уже начато. Заверши его или дождись истечения текущего кода и повтори /sg_connect.",
          };
        }
        return {
          text: [
            "На ноутбуке с установленным OpenClaw выполни в терминале:",
            "",
            "```",
            result.command,
            "```",
            "",
            `Код одноразовый, действует до ${new Date(result.expiresAtMs).toISOString()}.`,
            "После запуска напиши SG «готово»: SG покажет найденное устройство и попросит подтвердить его.",
          ].join("\n"),
        };
      } catch {
        // Dependency errors can contain credential-bearing URLs. Never echo them.
        return {
          text: "Не удалось подготовить подключение. Проверь доступность Gateway и повтори /sg_connect.",
        };
      }
    },
  });
}

export function createSgDeviceTools(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
  api: SgDeviceApi,
  deps: SgDeviceAccessDeps = defaultDeps,
): AnyAgentTool[] {
  const registry = new SgGlobalProfileRegistry(stateDir);
  return [
    {
      name: "sg_device",
      label: "Устройства SG",
      description:
        "Показывает и привязывает устройства текущего Global ID через штатный OpenClaw. Для начала подключения пользователь выполняет /sg_connect в личном чате; инструмент не выдаёт коды. После запуска команды на устройстве: finish, затем confirm только после явного подтверждения пользователя.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["connect", "finish", "confirm", "list"],
          },
        },
      },
      async execute(_toolCallId, rawParameters) {
        try {
          const globalId = await resolveToolGlobalId(ctx, stateDir);
          const action = clean((rawParameters as Record<string, unknown>).action);
          switch (action) {
            case "connect":
              return jsonResult({
                status: "command-required",
                command: "/sg_connect",
                instruction: "Попроси пользователя выполнить /sg_connect в личном чате с SG.",
              });
            case "finish":
              return jsonResult(await finishPairing({ api, registry, globalId, stateDir, deps }));
            case "confirm":
              return jsonResult(await confirmPairing({ api, registry, globalId, stateDir, deps }));
            case "list":
              return jsonResult({
                status: "ok",
                devices: await listOwnedDevices({ api, registry, globalId, stateDir, deps }),
              });
            default:
              return jsonResult({ status: "denied", reason: "action-unsupported" });
          }
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

export const SG_CRON_AUTHORITY_NAMESPACE = "sg-cron-creator";

type SgCronProof = {
  jobId: string;
  globalId: string;
  sessionKey: string;
  sessionId: string;
  agentId: string;
};

type CronProofInspection = { proof?: SgCronProof; code: string };

function inspectSgCronProof(
  api: { runContext?: OpenClawPluginApi["runContext"] },
  ctx: { runId?: string; sessionKey?: string; sessionId?: string },
): CronProofInspection {
  if (!ctx.runId || !ctx.sessionKey || !ctx.sessionId) return { code: "TOOL_CONTEXT_INCOMPLETE" };
  if (ctx.runId !== ctx.sessionId) return { code: "TOOL_RUN_ID_MISMATCH" };
  const raw = api.runContext?.getRunContext({
    runId: ctx.runId,
    namespace: SG_CRON_AUTHORITY_NAMESPACE,
  });
  if (!raw) return { code: "PROOF_ABSENT" };
  if (typeof raw !== "object" || Array.isArray(raw)) return { code: "PROOF_INVALID" };
  const proof = raw as Partial<SgCronProof>;
  if (!proof.jobId || !proof.globalId || !proof.agentId ||
      proof.sessionKey !== ctx.sessionKey || proof.sessionId !== ctx.sessionId ||
      ctx.sessionKey !== `agent:${proof.agentId}:cron:${proof.jobId}:run:${ctx.sessionId}`) {
    return { code: "PROOF_BINDING_INVALID" };
  }
  return { proof: proof as SgCronProof, code: "PROOF_VALID" };
}

export function readSgCronProof(
  api: { runContext?: OpenClawPluginApi["runContext"] },
  ctx: { runId?: string; sessionKey?: string; sessionId?: string },
): SgCronProof | undefined {
  return inspectSgCronProof(api, ctx).proof;
}

function cronRunHash(sessionId?: string): string {
  return sessionId ? createHash("sha256").update(sessionId).digest("hex").slice(0, 12) : "UNKNOWN";
}

function logCronAuthority(
  api: SgDeviceApi,
  kind: "proof" | "exec",
  sessionId: string | undefined,
  code: string,
): void {
  try {
    api.logger?.info(`[sg-device] cron-${kind} runHash=${cronRunHash(sessionId)} code=${code}`);
  } catch {
    // Diagnostic logging must not change tool access or cron execution.
  }
}

function cronJobIdFromRunContext(ctx: {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
}): string | undefined {
  const parts = ctx.sessionKey?.split(":");
  return parts?.length === 6 && parts[0] === "agent" &&
    parts[1] === ctx.agentId && parts[2] === "cron" &&
    parts[3] && parts[4] === "run" && parts[5] === ctx.sessionId
    ? parts[3]
    : undefined;
}

function cronCreatorIdentity(job: CronStoreFile["jobs"][number]): {
  channel: string; senderId: string;
} | undefined {
  const owner = job.owner;
  const policy = job.scheduledToolPolicy;
  if (!owner?.agentId || !owner.sessionKey || !owner.accountId ||
      policy?.mode !== "account" ||
      policy.ownerSessionKey !== owner.sessionKey ||
      policy.ownerAccountId !== owner.accountId ||
      job.payload.kind !== "agentTurn" ||
      !job.payload.toolsAllow?.includes("exec")) return undefined;
  const parts = owner.sessionKey.split(":");
  if (parts[0] !== "agent" || parts[1] !== owner.agentId) return undefined;
  if (parts.length === 5 && parts[3] === "direct" && parts[2] && parts[4]) {
    return { channel: parts[2], senderId: parts[4] };
  }
  if (parts.length === 6 && parts[3] === owner.accountId &&
      parts[4] === "direct" && parts[2] && parts[5]) {
    return { channel: parts[2], senderId: parts[5] };
  }
  return undefined;
}

function ownedNode(value: unknown, owned: Set<string>): string | undefined {
  const node = clean(value);
  return node && owned.has(normalizeDeviceId(node)) ? node : undefined;
}

function blocked(reason: string) {
  return { block: true, blockReason: reason };
}

export function registerSgDeviceOwnershipPolicy(
  params: {
    api: SgDeviceApi;
    stateDir: string;
  },
  deps: Pick<SgDeviceAccessDeps, "listPairing"> & {
    loadCronJobs?: () => Promise<CronStoreFile>;
  } = defaultDeps,
): void {
  const { api, stateDir } = params;
  const registry = new SgGlobalProfileRegistry(stateDir);

  api.on("before_agent_run", async (_event, ctx) => {
    if (ctx.trigger !== "cron") return;
    const audit = (code: string) => logCronAuthority(api, "proof", ctx.sessionId, code);
    const jobId = cronJobIdFromRunContext(ctx);
    if (!jobId) return audit("SESSION_BINDING_INVALID");
    if (!ctx.runId || !ctx.sessionId) return audit("RUN_CONTEXT_INCOMPLETE");
    if (ctx.runId !== ctx.sessionId) return audit("RUN_ID_MISMATCH");
    if (!api.runContext) return audit("RUN_CONTEXT_API_UNAVAILABLE");
    let stage = "STORE_READ";
    try {
      const store = deps.loadCronJobs
        ? await deps.loadCronJobs()
        : await (async () => {
            const { loadCronStore, resolveCronStorePath } =
              await import("openclaw/plugin-sdk/cron-store-runtime");
            return loadCronStore(resolveCronStorePath(api.config?.cron?.store));
          })();
      const job = store.jobs.find((candidate) => candidate.id === jobId);
      if (!job) return audit("JOB_NOT_FOUND");
      if (!job.enabled) return audit("JOB_DISABLED");
      if (!job.owner?.agentId) return audit("OWNER_AGENT_MISSING");
      if (ctx.agentId !== job.owner.agentId) return audit("AGENT_ID_MISMATCH");
      if (ctx.sessionKey !==
          `agent:${job.owner.agentId}:cron:${job.id}:run:${ctx.sessionId}`) {
        return audit("SESSION_KEY_MISMATCH");
      }
      const creator = cronCreatorIdentity(job);
      if (!creator) return audit("OWNER_POLICY_INVALID");
      const canonical = resolveSgCanonicalIdentity({
        ...creator,
        identityLinks: api.config?.session?.identityLinks,
      });
      if (!canonical) return audit("OWNER_IDENTITY_UNRESOLVED");
      stage = "PROFILE_LOOKUP";
      const profile = await registry.findByCanonicalIdentity(canonical);
      if (!profile) return audit("PROFILE_NOT_FOUND");
      if (profile.status !== "active" || profile.role !== "monarch") {
        return audit("PROFILE_NOT_ACTIVE_MONARCH");
      }
      stage = "PROOF_SET";
      const saved = api.runContext.setRunContext({
        runId: ctx.runId,
        namespace: SG_CRON_AUTHORITY_NAMESPACE,
        value: {
          jobId: job.id,
          globalId: profile.globalId,
          sessionKey: ctx.sessionKey,
          sessionId: ctx.sessionId,
          agentId: job.owner.agentId,
        },
      });
      audit(saved ? "PROOF_SET" : "PROOF_SET_REJECTED");
    } catch {
      // Fail closed; never log credential-bearing dependency errors.
      audit(`${stage}_ERROR`);
    }
  });

  api.on("before_tool_call", async (event, ctx) => {
    const cronCheck = inspectSgCronProof(api, ctx);
    const cronProof = cronCheck.proof;
    const cronProfile = cronProof
      ? await registry.findByGlobalId(cronProof.globalId)
      : undefined;
    if (event.toolName === "exec" && ctx.sessionKey?.includes(":cron:")) {
      const code = cronProof && (cronProfile?.status !== "active" ||
        cronProfile.role !== "monarch") ? "PROOF_PROFILE_INVALID" : cronCheck.code;
      logCronAuthority(api, "exec", ctx.sessionId, code);
    }
    if (event.toolName === "exec" && cronProfile?.status === "active" &&
        cronProfile.role === "monarch") {
      const host = clean(event.params.host);
      if (!host) return { params: { ...event.params, host: "gateway" } };
      if (host === "gateway") return undefined;
    }
    if (!ctx.requester) {
      return ctx.sessionKey?.includes(":cron:") &&
        ["exec", "nodes", "computer", "mobile_ui", "file_fetch",
          "dir_list", "dir_fetch", "file_write"].includes(event.toolName)
        ? blocked("SG could not verify the requester Global ID for device access")
        : undefined;
    }
    const globalId = await requesterGlobalId(api, stateDir, ctx).catch(() => undefined);
    const nodeTool =
      event.toolName === "nodes" ||
      event.toolName === "exec" ||
      event.toolName === "computer" ||
      event.toolName === "mobile_ui" ||
      ["file_fetch", "dir_list", "dir_fetch", "file_write"].includes(event.toolName) ||
      (event.toolName === "browser" &&
        (clean(event.params.node) || clean(event.params.target) === "node"));
    if (!globalId) {
      return nodeTool
        ? blocked("SG could not verify the requester Global ID for device access")
        : undefined;
    }

    const owned = await ownedDeviceIds(registry, globalId);

    if (event.toolName === "nodes") {
      const action = clean(event.params.action);
      if (action === "status" || action === "pending") {
        return blocked("Use sg_device list; the raw Gateway node catalog is not user-scoped");
      }
      if (action === "approve" || action === "reject") {
        const requestId = clean(event.params.requestId);
        if (!requestId) {
          return blocked("Node pairing approval requires an exact requestId");
        }
        const pairing = await deps.listPairing(stateDir).catch(() => ({ pending: [], paired: [] }));
        const requestOwned = pairing.paired.some(
          (device) =>
            owned.has(normalizeDeviceId(device.deviceId)) &&
            pendingNodeApprovalRequestId(device) === requestId,
        );
        return requestOwned
          ? undefined
          : blocked("Node pairing request does not belong to the current Global ID");
      }
      return ownedNode(event.params.node, owned)
        ? undefined
        : blocked("Use an exact node ID owned by the current Global ID");
    }

    if (event.toolName === "exec") {
      return clean(event.params.host) === "node" && ownedNode(event.params.node, owned)
        ? undefined
        : blocked("Message-origin exec is allowed only on a node owned by the current Global ID");
    }

    if (event.toolName === "computer" || event.toolName === "mobile_ui") {
      return ownedNode(event.params.node, owned)
        ? undefined
        : blocked("Use an exact node ID owned by the current Global ID");
    }

    if (["file_fetch", "dir_list", "dir_fetch", "file_write"].includes(event.toolName)) {
      return ownedNode(event.params.node, owned)
        ? undefined
        : blocked("File access requires an exact node ID owned by the current Global ID");
    }

    if (event.toolName === "browser") {
      const requestedNode = clean(event.params.node);
      const target = clean(event.params.target);
      if (requestedNode || target === "node") {
        return ownedNode(requestedNode, owned)
          ? undefined
          : blocked("Browser node access requires an exact node ID owned by the current Global ID");
      }
      if (!target) {
        const runtime = await api.runtime.nodes?.list({}).catch(() => ({ nodes: [] }));
        const browserNodes = (runtime?.nodes ?? []).filter(
          (node) =>
            owned.has(normalizeDeviceId(node.nodeId)) &&
            node.connected === true &&
            (node.caps?.includes("browser") || node.commands?.includes("browser.proxy")),
        );
        return browserNodes.length === 1
          ? {
              params: {
                ...event.params,
                target: "node",
                node: browserNodes[0]!.nodeId,
              },
            }
          : { params: { ...event.params, target: "host" } };
      }
      return undefined;
    }

    if (event.toolName.startsWith("sg_")) return undefined;

    const runtime = await api.runtime.nodes?.list({}).catch(() => ({ nodes: [] }));
    const publishers = (runtime?.nodes ?? []).filter((node) =>
      (node.nodePluginTools ?? []).some((tool) => clean(tool.name) === event.toolName),
    );
    if (publishers.length === 0) return undefined;
    if (publishers.length !== 1) {
      return blocked("Node-published tool is ambiguous across multiple devices");
    }
    return owned.has(normalizeDeviceId(publishers[0]!.nodeId))
      ? undefined
      : blocked("Node-published tool belongs to another Global ID");
  });
}
