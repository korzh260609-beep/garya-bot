import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import type { MemorySearchManager } from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import type { OpenClawConfig } from "openclaw/plugin-sdk/memory-core-host-runtime-core";
import { describe, expect, it } from "vitest";
import {
  createManagerIndexFixture,
  type ManagerIndexFixture,
} from "../../extensions/memory-core/src/memory/manager-index.test-support.js";
import { createPersonalMemoryTools } from "./personal-memory-tools.js";

const { closeAllMemorySearchManagers, getMemorySearchManager } =
  await import("../../extensions/memory-core/src/memory/index.js");

function findTool(tools: ReturnType<typeof createPersonalMemoryTools>, name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

describe("Phase 9 personal memory with the real Memory Core index", () => {
  const indexFixture: ManagerIndexFixture = createManagerIndexFixture({
    getMemorySearchManager,
    closeAllMemorySearchManagers,
  });

  it("does not lose a forced write sync behind an already-running background sync", async () => {
    const stateDir = indexFixture.paths.root;
    const globalId = "usr_phase9_live";
    const senderId = "20";
    const personalWorkspace = `${stateDir}/sg/users/${globalId}`;
    const config = indexFixture.createConfig({
      provider: "openai",
      sources: ["memory"],
      vectorEnabled: true,
      minScore: 0.35,
    }) as OpenClawConfig;
    const baseContext = {
      config,
      messageChannel: "telegram",
      nativeChannelId: `telegram:${senderId}`,
      requesterSenderId: senderId,
      workspaceDir: indexFixture.paths.workspace,
      agentId: "main",
    };

    await mkdir(`${stateDir}/sg`, { recursive: true });
    await mkdir(personalWorkspace, { recursive: true });
    await writeFile(
      `${stateDir}/sg/global-profiles.json`,
      JSON.stringify({
        version: 5,
        profiles: [
          {
            globalId,
            canonicalIdentity: `channel:telegram:${senderId}`,
            role: "citizen",
            status: "active",
            createdAt: "2026-09-17T00:00:00.000Z",
            updatedAt: "2026-09-17T00:00:00.000Z",
          },
        ],
        identities: [
          {
            canonicalIdentity: `channel:telegram:${senderId}`,
            globalId,
            createdAt: "2026-09-17T00:00:00.000Z",
            updatedAt: "2026-09-17T00:00:00.000Z",
          },
        ],
      }),
    );

    let manager: MemorySearchManager | null = null;
    const managerLoader = async (params: { cfg: OpenClawConfig; agentId: string }) => {
      const loaded = await getMemorySearchManager(params);
      manager = loaded.manager;
      return loaded;
    };
    const firstSession = createPersonalMemoryTools(
      { ...baseContext, sessionKey: "agent:main:telegram:direct:20:first" },
      stateDir,
      managerLoader,
    );
    await findTool(firstSession, "sg_memory_remember").execute("remember-baseline", {
      text: "Исходная запись alpha.",
    });
    if (!manager) {
      throw new Error("personal memory manager missing");
    }

    await appendFile(`${personalWorkspace}/MEMORY.md`, "\nФоновая запись beta.\n");
    const managerInternals = manager as unknown as {
      indexFile: (entry: unknown, options: unknown) => Promise<void>;
    };
    const originalIndexFile = managerInternals.indexFile.bind(manager);
    let releaseIndex!: () => void;
    const indexGate = new Promise<void>((resolve) => {
      releaseIndex = resolve;
    });
    let reportIndexReached!: () => void;
    const indexReached = new Promise<void>((resolve) => {
      reportIndexReached = resolve;
    });
    let blocked = false;
    managerInternals.indexFile = async (entry, options) => {
      if (!blocked) {
        blocked = true;
        const capturedContent = await readFile(`${personalWorkspace}/MEMORY.md`, "utf8");
        reportIndexReached();
        await indexGate;
        await originalIndexFile(
          { ...(entry as Record<string, unknown>), content: capturedContent },
          options,
        );
        return;
      }
      await originalIndexFile(entry, options);
    };
    const backgroundSync = manager.sync?.({ reason: "background", force: true });
    await indexReached;

    const remember = findTool(firstSession, "sg_memory_remember").execute("remember-live", {
      text: "После нового сеанса нужно проверить зелёный маяк возле северных ворот.",
    });
    await expect
      .poll(async () =>
        (await readFile(`${personalWorkspace}/MEMORY.md`, "utf8")).includes("зелёный маяк"),
      )
      .toBe(true);
    releaseIndex();
    await backgroundSync;
    await remember;

    const search = await manager.search(
      "После нового сеанса нужно проверить зелёный маяк возле северных ворот",
      { maxResults: 20, sources: ["memory"] },
    );

    expect(search).toEqual([
      expect.objectContaining({
        snippet: expect.stringContaining("зелёный маяк возле северных ворот"),
      }),
    ]);
  });
});
