import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  MemoryReadResult,
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import {
  createPersonalMemoryTools,
  type PersonalMemoryManagerLoader,
} from "./personal-memory-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-personal-memory-"));
  const workspaceDir = path.join(root, "workspace");
  await mkdir(path.join(root, "sg"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  const users = [
    ["usr_a", "20"],
    ["usr_b", "30"],
  ] as const;
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      profiles: users.map(([globalId, senderId]) => ({
        globalId,
        canonicalIdentity: `channel:telegram:${senderId}`,
        role: "citizen",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      identities: users.map(([globalId, senderId]) => ({
        canonicalIdentity: `channel:telegram:${senderId}`,
        globalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    }),
  );
  return { root, workspaceDir };
}

async function markdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(target);
    }
  }
  return files;
}

function nativeManager(workspaceDir: string, usersRoot: string): MemorySearchManager {
  const read = async (relPath: string): Promise<MemoryReadResult> => {
    const target = path.resolve(workspaceDir, relPath);
    const text = await readFile(target, "utf8").catch(() => undefined);
    return text === undefined
      ? { status: "not_found", text: "", path: relPath }
      : { status: "ok", text, path: relPath };
  };
  return {
    async search(query): Promise<MemorySearchResult[]> {
      const hits: MemorySearchResult[] = [];
      for (const file of await markdownFiles(usersRoot)) {
        const text = await readFile(file, "utf8");
        if (text.toLowerCase().includes(query.toLowerCase())) {
          hits.push({
            path: path.relative(workspaceDir, file).replaceAll("\\", "/"),
            startLine: 1,
            endLine: text.split("\n").length,
            score: 1,
            snippet: text,
            source: "memory",
          });
        }
      }
      return hits;
    },
    readFile: ({ relPath }) => read(relPath),
    status: () => ({ backend: "builtin", provider: "none", workspaceDir }),
    async sync() {},
    async probeEmbeddingAvailability() {
      return { ok: true };
    },
    async probeVectorAvailability() {
      return false;
    },
  };
}

function loader(manager: MemorySearchManager): PersonalMemoryManagerLoader {
  return async () => ({ manager });
}

function context(senderId: string, workspaceDir: string, nativeChannelId: string) {
  return {
    config: {},
    messageChannel: "telegram",
    nativeChannelId,
    requesterSenderId: senderId,
    workspaceDir,
    agentId: "main",
    sessionKey: nativeChannelId.includes("-100") ? "agent:main:telegram:group:-100" : `agent:main:telegram:direct:${senderId}`,
  };
}

function findTool(tools: ReturnType<typeof createPersonalMemoryTools>, name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

describe("SG Global-ID personal memory", () => {
  it("shares one citizen memory between direct and group turns", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const remember = findTool(
      createPersonalMemoryTools(context("20", workspaceDir, "telegram:20"), root, loader(manager)),
      "sg_memory_remember",
    );
    await remember.execute("remember", { text: "Любимый цвет — зелёный" });

    const search = findTool(
      createPersonalMemoryTools(
        context("20", workspaceDir, "telegram:-100500"),
        root,
        loader(manager),
      ),
      "sg_memory_search",
    );
    expect(details(await search.execute("search", { query: "зелёный" }))).toMatchObject({
      globalId: "usr_a",
      results: [expect.objectContaining({ snippet: expect.stringContaining("зелёный") })],
    });
  });

  it("does not expose one citizen memory to another citizen", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const remember = findTool(
      createPersonalMemoryTools(context("20", workspaceDir, "telegram:20"), root, loader(manager)),
      "sg_memory_remember",
    );
    await remember.execute("remember", { text: "Закрытый маркер ALPHA-PRIVATE-42" });

    const search = findTool(
      createPersonalMemoryTools(context("30", workspaceDir, "telegram:30"), root, loader(manager)),
      "sg_memory_search",
    );
    expect(details(await search.execute("search", { query: "ALPHA-PRIVATE-42" }))).toMatchObject({
      globalId: "usr_b",
      results: [],
    });
  });

  it("keeps personal memory after a simulated plugin restart", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const first = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(manager),
    );
    await findTool(first, "sg_memory_remember").execute("remember", {
      text: "Незавершённая задача — проверить Phase 6",
    });

    const restarted = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(nativeManager(workspaceDir, path.join(root, "sg", "users"))),
    );
    expect(
      details(
        await findTool(restarted, "sg_memory_search").execute("search", {
          query: "Phase 6",
        }),
      ),
    ).toMatchObject({
      results: [expect.objectContaining({ snippet: expect.stringContaining("Phase 6") })],
    });
  });

  it("fails closed without a trusted requester identity", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const tools = createPersonalMemoryTools(
      {
        config: {},
        messageChannel: "telegram",
        nativeChannelId: "telegram:-100500",
        workspaceDir,
        agentId: "main",
        sessionKey: "agent:main:telegram:group:-100500",
      },
      root,
      loader(manager),
    );
    await expect(
      findTool(tools, "sg_memory_search").execute("search", { query: "anything" }),
    ).rejects.toThrow(/identity|citizen|sender/iu);
  });
});
