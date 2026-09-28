import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import {
  issueDeviceBootstrapToken,
  listDevicePairing,
} from "openclaw/plugin-sdk/device-bootstrap";
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
  register(
    key: string,
    value: SgPairingSession,
    opts?: { ttlMs?: number },
  ): Promise<void>;
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
    state: {
      openKeyedStore?: OpenClawPluginApi["runtime"]["state"]["openKeyedStore"];
    };
    nodes?: Pick<OpenClawPluginApi["runtime"]["nodes"], "list">;
  };
  on: OpenClawPluginApi["on"];
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

function isNodeOnlyBootstrapDevice(
  device: PairedDevice,
  session: SgPairingSession,
): boolean {
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

function openPairingStore(api: SgDeviceApi): PairingStore {
  if (!api.runtime.state.openKeyedStore) {
    throw new Error("sg-device-plugin-state-unavailable");
  }
  return api.runtime.state.openKeyedStore<SgPairingSession>({
    namespace: PAIRING_NAMESPACE,
    maxEntries: 1,
    overflowPolicy: "reject-new",
  }) as PairingStore;
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
  const store = openPairingStore(params.api);
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
      status: "busy",
      owner: active?.globalId === params.globalId ? "self" : "another-user",
      expiresAtMs: active?.expiresAtMs,
    };
  }

  try {
    const issued = await params.deps.issueNodeBootstrap(params.stateDir);
    await store.register(
      PAIRING_KEY,
      { ...session, expiresAtMs: issued.expiresAtMs },
      { ttlMs: Math.max(1_000, issued.expiresAtMs - params.deps.now()) },
    );
    const gatewayUrl = resolveGatewayUrl(params.api.config);
    const setupCode = encodeSetupCode({
      gatewayUrl,
      token: issued.token,
      expiresAtMs: issued.expiresAtMs,
    });
    const version = clean(params.api.runtime.version) || "2026.8.1";
    return {
      status: "ready",
      expiresAtMs: issued.expiresAtMs,
      setupCode,
      command: `npx openclaw@${version} connect "oc-pair://${setupCode}" --service`,
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
  const store = openPairingStore(params.api);
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
  };
}

async function confirmPairing(params: {
  api: SgDeviceApi;
  registry: SgGlobalProfileRegistry;
  globalId: string;
  stateDir: string;
  deps: SgDeviceAccessDeps;
}) {
  const store = openPairingStore(params.api);
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

  await params.registry.linkIdentity(
    params.globalId,
    canonicalSgDeviceIdentity(device.deviceId),
  );
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
        (candidate) =>
          normalizeDeviceId(candidate.nodeId) === normalizeDeviceId(device.deviceId),
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
      };
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
        "Подключает и показывает устройства текущего Global ID. OpenClaw остаётся владельцем pairing, Node transport и device capabilities.",
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
              return jsonResult(await beginPairing({ api, globalId, stateDir, deps }));
            case "finish":
              return jsonResult(
                await finishPairing({ api, registry, globalId, stateDir, deps }),
              );
            case "confirm":
              return jsonResult(
                await confirmPairing({ api, registry, globalId, stateDir, deps }),
              );
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

function ownedNode(value: unknown, owned: Set<string>): string | undefined {
  const node = clean(value);
  return node && owned.has(normalizeDeviceId(node)) ? node : undefined;
}

function blocked(reason: string) {
  return { block: true, blockReason: reason };
}

export function registerSgDeviceOwnershipPolicy(params: {
  api: SgDeviceApi;
  stateDir: string;
}): void {
  const { api, stateDir } = params;
  const registry = new SgGlobalProfileRegistry(stateDir);

  api.on("before_tool_call", async (event, ctx) => {
    if (!ctx.requester) return undefined;
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
