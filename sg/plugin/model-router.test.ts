import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assessSgModelTier,
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
      on: vi.fn((name, handler) => hooks.set(name, handler)),
      registerCommand: vi.fn((command) => commands.push(command)),
      logger,
    },
  });
  const hook = hooks.get("before_model_resolve");
  const command = commands.find((candidate) => candidate.name === "sg_model");
  if (!hook || !command) {
    throw new Error("router contracts were not registered");
  }
  return { hook, command, logger };
}

describe("SG model router", () => {
  it("classifies only bounded short work as cheap and escalates structured large work", () => {
    expect(assessSgModelTier({ prompt: "Переведи слово hello" })).toMatchObject({
      tier: "cheap",
      reasons: ["bounded-short-request"],
    });
    expect(
      assessSgModelTier({
        prompt: "Проанализируй документ и составь рекомендации для проекта.",
        attachments: [{ kind: "document", mimeType: "application/pdf" }],
      }),
    ).toMatchObject({ tier: "medium" });
    expect(
      assessSgModelTier({
        prompt: `Исправь архитектуру:\n\n\`\`\`ts\n${"const value = 1;\n".repeat(150)}\`\`\``,
      }),
    ).toMatchObject({ tier: "expensive" });
    expect(assessSgModelTier({ prompt: "" })).toMatchObject({
      tier: "medium",
      reasons: ["conservative-default"],
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
      expect.stringContaining("decision=shadow mode=auto tier=cheap route=openai/gpt-5.6-luna"),
    );
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

  it("defaults unknown activation values to shadow", () => {
    expect(resolveSgModelRouterActivation({ SG_MODEL_ROUTING_ACTIVATION: "unexpected" })).toBe(
      "shadow",
    );
    expect(resolveSgModelRouterActivation({ SG_MODEL_ROUTING_ACTIVATION: "active" })).toBe(
      "active",
    );
  });
});
