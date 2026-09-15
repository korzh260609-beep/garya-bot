import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  MemoryReadResult,
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import { describe, expect, it } from "vitest";
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
    sessionKey: nativeChannelId.includes("-100")
      ? "agent:main:telegram:group:-100"
      : `agent:main:telegram:direct:${senderId}`,
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
  it("returns a stable entry id and the exact personal scope for a saved fact", async () => {
    const { root, workspaceDir } = await fixture();
    const tools = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(nativeManager(workspaceDir, path.join(root, "sg", "users"))),
    );

    expect(
      details(
        await findTool(tools, "sg_memory_remember").execute("remember", {
          text: "Контракт Phase 9 — стабильный идентификатор",
        }),
      ),
    ).toMatchObject({
      saved: true,
      globalId: "usr_a",
      path: "MEMORY.md",
      entryId: expect.stringMatching(/^mem-/u),
    });
  });

  it("corrects one inaccurate personal entry without returning the superseded text", async () => {
    const { root, workspaceDir } = await fixture();
    const tools = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(nativeManager(workspaceDir, path.join(root, "sg", "users"))),
    );
    const saved = details(
      await findTool(tools, "sg_memory_remember").execute("remember", {
        text: "Предпочитаемый цвет — красный",
      }),
    );

    expect(
      details(
        await findTool(tools, "sg_memory_correct").execute("correct", {
          entryId: saved.entryId,
          text: "Предпочитаемый цвет — зелёный",
        }),
      ),
    ).toMatchObject({ status: "corrected", globalId: "usr_a", supersedesId: saved.entryId });
    expect(
      details(
        await findTool(tools, "sg_memory_search").execute("search", {
          query: "Предпочитаемый цвет",
        }),
      ),
    ).toMatchObject({
      globalId: "usr_a",
      results: [expect.objectContaining({ snippet: expect.stringContaining("зелёный") })],
    });
    expect(
      JSON.stringify(
        details(
          await findTool(tools, "sg_memory_search").execute("search-old", {
            query: "Предпочитаемый цвет",
          }),
        ),
      ),
    ).not.toContain("красный");
  });

  it("does not let another Global ID correct or forget a personal entry", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const owner = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(manager),
    );
    const other = createPersonalMemoryTools(
      context("30", workspaceDir, "telegram:30"),
      root,
      loader(manager),
    );
    const saved = details(
      await findTool(owner, "sg_memory_remember").execute("remember", {
        text: "PHASE9-OWNER-ONLY-MUTATION",
      }),
    );

    await expect(
      findTool(other, "sg_memory_correct").execute("correct", {
        entryId: saved.entryId,
        text: "unauthorized correction",
      }),
    ).rejects.toThrow(/not-found/iu);
    await expect(
      findTool(other, "sg_memory_forget").execute("forget", { entryId: saved.entryId }),
    ).rejects.toThrow(/not-found/iu);
    expect(
      JSON.stringify(
        details(
          await findTool(owner, "sg_memory_search").execute("search", {
            query: "PHASE9-OWNER-ONLY-MUTATION",
          }),
        ),
      ),
    ).toContain("PHASE9-OWNER-ONLY-MUTATION");
  });

  it("forgets only the selected personal entry", async () => {
    const { root, workspaceDir } = await fixture();
    const tools = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(nativeManager(workspaceDir, path.join(root, "sg", "users"))),
    );
    const selected = details(
      await findTool(tools, "sg_memory_remember").execute("remember-selected", {
        text: "Удаляемый маркер PHASE9-FORGET-SELECTED",
      }),
    );
    await findTool(tools, "sg_memory_remember").execute("remember-kept", {
      text: "Сохраняемый маркер PHASE9-KEEP",
    });

    expect(
      details(
        await findTool(tools, "sg_memory_forget").execute("forget", {
          entryId: selected.entryId,
        }),
      ),
    ).toMatchObject({ status: "forgotten", globalId: "usr_a", entryId: selected.entryId });
    expect(
      details(
        await findTool(tools, "sg_memory_search").execute("search-forgotten", {
          query: "PHASE9-FORGET-SELECTED",
        }),
      ),
    ).toMatchObject({ results: [] });
    expect(
      details(
        await findTool(tools, "sg_memory_search").execute("search-kept", {
          query: "PHASE9-KEEP",
        }),
      ).results,
    ).not.toEqual([]);
  });

  it("exports only the requesting Global ID personal memory", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    const first = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(manager),
    );
    const second = createPersonalMemoryTools(
      context("30", workspaceDir, "telegram:30"),
      root,
      loader(manager),
    );
    await findTool(first, "sg_memory_remember").execute("first", {
      text: "PHASE9-EXPORT-OWNER",
    });
    await findTool(second, "sg_memory_remember").execute("second", {
      text: "PHASE9-EXPORT-OTHER-PRIVATE",
    });

    const exported = details(await findTool(first, "sg_memory_export").execute("export", {}));
    expect(exported).toMatchObject({ status: "ok", globalId: "usr_a" });
    expect(JSON.stringify(exported)).toContain("PHASE9-EXPORT-OWNER");
    expect(JSON.stringify(exported)).not.toContain("PHASE9-EXPORT-OTHER-PRIVATE");
  });

  it("forces Memory Core to rebuild only the current personal scope", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir, path.join(root, "sg", "users"));
    let forced = false;
    manager.sync = async (options) => {
      forced = options?.force === true;
    };
    const tools = createPersonalMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loader(manager),
    );

    expect(
      details(await findTool(tools, "sg_memory_reindex").execute("reindex", {})),
    ).toMatchObject({ status: "ok", globalId: "usr_a" });
    expect(forced).toBe(true);
  });

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
