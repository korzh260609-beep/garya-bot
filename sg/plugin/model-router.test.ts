import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("openclaw/plugin-sdk/embedding-providers", () => ({
  getEmbeddingProvider: () => ({
    create: async () => ({
      provider: { model: "text-embedding-3-small", embed: async () => [1, 0] },
    }),
  }),
}));
import {
  registerSgModelRouter,
  resolveSgModelRouterActivation,
  SgModelPreferenceRegistry,
  SgModelRegistry,
  type SgModelRoute,
} from "./model-router.js";

async function createStateDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "sg-model-router-"));
}

function registerRouter(
  stateDir: string,
  activation: "off" | "shadow" | "active",
  logger = { info: vi.fn(), warn: vi.fn() },
  getSessionMessages?: (params: {
    sessionKey: string;
    limit: number;
  }) => Promise<{ messages: unknown[] }>,
) {
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  const commands: Array<{
    name: string;
    handler: (ctx: {
      channel: string;
      senderId?: string;
      args?: string;
      config: { session?: { identityLinks?: Record<string, string[]> } };
    }) => Promise<{ text: string }>;
  }> = [];
  registerSgModelRouter({
    stateDir,
    env: { SG_MODEL_ROUTING_ACTIVATION: activation },
    api: {
      config: {},
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      registerCommand: vi.fn((command) => commands.push(command)),
      logger,
      ...(getSessionMessages ? { runtime: { subagent: { getSessionMessages } } } : {}),
    },
  });
  const hook = hooks.get("before_model_resolve");
  const command = commands.find((candidate) => candidate.name === "sg_model");
  if (!hook || !command) {
    throw new Error("router contracts were not registered");
  }
  return { hook, hooks, command, logger };
}

describe("SG model router", () => {
  it("uses the same semantic hook for multilingual requests after a qualified corpus is supplied", async () => {
    const stateDir = await createStateDir();
    const file = path.join(stateDir, "sg", "model-router-corpus.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        embedding: { provider: "openai", model: "text-embedding-3-small" },
        examples: Array.from({ length: 101 }, (_, index) => ({
          taskId: `task-${index}`,
          familyId: `family-${index}`,
          language: ["ru", "en", "ja"][index % 3],
          vector: [1, 0],
          trials: [
            { tier: "cheap", succeeded: true, quality: 1, totalCost: 1 },
            { tier: "medium", succeeded: true, quality: 1, totalCost: 3 },
            { tier: "expensive", succeeded: true, quality: 1, totalCost: 7 },
          ],
        })),
      }),
    );
    const { hook } = registerRouter(stateDir, "active");
    for (const prompt of ["Проведи аудит системы", "Audit the system", "システムを監査して"]) {
      await expect(hook({ prompt }, { channel: "telegram", senderId: "100" })).resolves.toEqual({
        providerOverride: "openai",
        modelOverride: "gpt-5.6-luna",
      });
    }
    await expect(
      hook(
        { prompt: "Audit", attachments: [{ kind: "document" }] },
        { channel: "telegram", senderId: "100" },
      ),
    ).resolves.toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-5.6-terra",
    });
  });
  it("selects the highest-priority enabled provider route with required capabilities", () => {
    const routes: SgModelRoute[] = [
      {
        provider: "openai",
        model: "gpt-5.6-terra",
        tier: "medium",
        capabilities: ["text", "attachments"],
        enabled: true,
        priority: 10,
      },
      {
        provider: "anthropic",
        model: "future-claude",
        tier: "medium",
        capabilities: ["text"],
        enabled: true,
        priority: 20,
      },
      {
        provider: "google",
        model: "future-gemini",
        tier: "medium",
        capabilities: ["text", "attachments"],
        enabled: false,
        priority: 30,
      },
    ];
    const registry = new SgModelRegistry(routes);
    expect(registry.select("medium", ["text"])).toMatchObject({ provider: "anthropic" });
    expect(registry.select("medium", ["text", "attachments"])).toMatchObject({
      provider: "openai",
    });
  });

  it("persists preferences independently for each Global ID", async () => {
    const stateDir = await createStateDir();
    const registry = new SgModelPreferenceRegistry(stateDir);
    await registry.set("usr_one", "cheap");
    await registry.set("usr_two", "expensive");
    await expect(new SgModelPreferenceRegistry(stateDir).get("usr_one")).resolves.toBe("cheap");
    await expect(new SgModelPreferenceRegistry(stateDir).get("usr_two")).resolves.toBe("expensive");
    await expect(new SgModelPreferenceRegistry(stateDir).get("usr_new")).resolves.toBe("auto");
  });

  it("lets a manual mode override auto classification in active mode", async () => {
    const stateDir = await createStateDir();
    const { hook, command } = registerRouter(stateDir, "active");
    await expect(
      command.handler({ channel: "telegram", senderId: "100", args: "expensive", config: {} }),
    ).resolves.toEqual({
      text: expect.stringContaining("Модель: openai/gpt-5.6-sol"),
    });
    await expect(
      hook(
        { prompt: "Привет" },
        { channel: "telegram", accountId: "default", senderId: "100", runId: "run-1" },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-sol" });
  });

  it("computes and logs a decision without overriding in shadow mode", async () => {
    const stateDir = await createStateDir();
    const { hook, logger } = registerRouter(stateDir, "shadow");
    await expect(
      hook(
        { prompt: "Короткий вопрос" },
        { channel: "telegram", senderId: "200", runId: "run-shadow" },
      ),
    ).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("decision=shadow mode=auto tier=medium route=openai/gpt-5.6-terra"),
    );
  });

  it("selects a route without keeping a parallel per-run routing state", async () => {
    const stateDir = await createStateDir();
    const { hook } = registerRouter(stateDir, "active");
    const session = {
      channel: "telegram",
      accountId: "default",
      senderId: "100",
      sessionKey: "agent:main:telegram:direct:100",
    };
    const arithmetic = "Сколько будет 2+2?";
    const analysis =
      "Проанализируй архитектуру многопользовательского ИИ-помощника: безопасность, память, биллинг и маршрутизацию моделей. Найди риски и предложи план проверки.";

    await expect(hook({ prompt: arithmetic }, { ...session, runId: "turn-1" })).resolves.toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-5.6-terra",
    });
    await expect(hook({ prompt: analysis }, { ...session, runId: "turn-1" })).resolves.toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-5.6-terra",
    });
    await expect(hook({ prompt: analysis }, { ...session, runId: "turn-2" })).resolves.toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-5.6-terra",
    });
  });

  it("uses only the native session for short continuations of complex work", async () => {
    const stateDir = await createStateDir();
    const getSessionMessages = vi.fn(async () => ({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Проанализируй архитектуру: безопасность, память, биллинг. Найди риски и предложи план.",
            },
          ],
        },
        { role: "assistant", content: [{ type: "text", text: "Сначала проверю." }] },
      ],
    }));
    const { hook } = registerRouter(stateDir, "active", undefined, getSessionMessages);
    await expect(
      hook(
        { prompt: "Продолжай" },
        {
          channel: "telegram",
          senderId: "100",
          sessionKey: "agent:main:telegram:direct:100",
          trigger: "user",
        },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-terra" });
    expect(getSessionMessages).toHaveBeenCalledWith({
      sessionKey: "agent:main:telegram:direct:100",
      limit: 8,
    });
  });

  it("never classifies a continuation as cheap without trustworthy context", async () => {
    const stateDir = await createStateDir();
    const { hook } = registerRouter(stateDir, "active");
    await expect(
      hook({ prompt: "Continue" }, { channel: "telegram", senderId: "100" }),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-terra" });
  });

  it("does not read a group transcript containing other users' requests", async () => {
    const stateDir = await createStateDir();
    const getSessionMessages = vi.fn(async () => ({ messages: [] }));
    const { hook } = registerRouter(stateDir, "active", undefined, getSessionMessages);
    await expect(
      hook(
        { prompt: "Continue" },
        {
          channel: "telegram",
          senderId: "100",
          sessionKey: "agent:main:telegram:group:500",
        },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-terra" });
    expect(getSessionMessages).not.toHaveBeenCalled();
  });

  it("falls back conservatively if the native session read fails", async () => {
    const stateDir = await createStateDir();
    const getSessionMessages = vi.fn(async () => {
      throw new Error("session read unavailable");
    });
    const { hook, logger } = registerRouter(stateDir, "active", undefined, getSessionMessages);
    await expect(
      hook(
        { prompt: "Продовжуй" },
        {
          channel: "telegram",
          senderId: "100",
          sessionKey: "agent:main:telegram:direct:100",
        },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-terra" });
    expect(logger.warn).toHaveBeenCalledWith("[sg-model-router] continuation-history-unavailable");
  });

  it("does not read history when a user selected a fixed model", async () => {
    const stateDir = await createStateDir();
    const getSessionMessages = vi.fn(async () => ({ messages: [] }));
    const { hook, command } = registerRouter(stateDir, "active", undefined, getSessionMessages);
    await command.handler({ channel: "telegram", senderId: "100", args: "cheap", config: {} });
    await expect(
      hook(
        { prompt: "Continue" },
        {
          channel: "telegram",
          senderId: "100",
          sessionKey: "agent:main:telegram:direct:100",
        },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-luna" });
    expect(getSessionMessages).not.toHaveBeenCalled();
  });

  it("routes only user turns and does not let internal controller runs select a route", async () => {
    const stateDir = await createStateDir();
    const { hook, logger } = registerRouter(stateDir, "active");
    const session = {
      channel: "telegram",
      accountId: "default",
      senderId: "100",
      sessionKey: "agent:main:telegram:direct:100",
    };

    await expect(
      hook(
        { prompt: "Проверь внутренний отчёт контролёра" },
        { ...session, runId: "internal-review", trigger: "manual" },
      ),
    ).resolves.toBeUndefined();
    await expect(
      hook(
        { prompt: "Сколько будет 2+2?" },
        { ...session, runId: "telegram-turn", trigger: "user" },
      ),
    ).resolves.toEqual({ providerOverride: "openai", modelOverride: "gpt-5.6-terra" });
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("internal-review"));
  });

  it("registers no model lifecycle or delivery hooks", async () => {
    const stateDir = await createStateDir();
    const { hooks } = registerRouter(stateDir, "active");
    expect([...hooks.keys()]).toEqual(["before_model_resolve"]);
  });

  it("retains the current model on missing identity or invalid persisted state", async () => {
    const stateDir = await createStateDir();
    const { hook, logger } = registerRouter(stateDir, "active");
    await expect(
      hook({ prompt: "private prompt" }, { channel: "telegram" }),
    ).resolves.toBeUndefined();
    const routingFile = path.join(stateDir, "sg", "model-routing.json");
    await mkdir(path.dirname(routingFile), { recursive: true });
    await writeFile(routingFile, JSON.stringify({ version: 99, preferences: [] }));
    await expect(
      hook({ prompt: "secret body" }, { channel: "telegram", senderId: "300" }),
    ).resolves.toBeUndefined();
    const logs = [...logger.info.mock.calls, ...logger.warn.mock.calls].flat().join("\n");
    expect(logs).toContain("trusted-identity-missing");
    expect(logs).toContain("sg-model-routing-store-invalid");
    expect(logs).not.toContain("private prompt");
    expect(logs).not.toContain("secret body");
    expect(await readFile(routingFile, "utf8")).toContain('"version":99');
  });

  it("retains the configured model when the runtime exposes no user prompt", async () => {
    const stateDir = await createStateDir();
    const { hook, logger } = registerRouter(stateDir, "active");
    await expect(
      hook({ prompt: "" }, { channel: "telegram", senderId: "301" }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("reason=prompt-empty"));
  });

  it("defaults unknown activation values to shadow", () => {
    expect(resolveSgModelRouterActivation({ SG_MODEL_ROUTING_ACTIVATION: "unexpected" })).toBe(
      "shadow",
    );
    expect(resolveSgModelRouterActivation({ SG_MODEL_ROUTING_ACTIVATION: "active" })).toBe(
      "active",
    );
  });
});
