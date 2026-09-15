import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  MemoryReadResult,
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it } from "vitest";
import {
  createResourceMemoryTools,
  RESOURCE_MEMORY_AGENT_GUIDANCE,
  type ResourceMemoryManagerLoader,
} from "./resource-memory-tools.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

type TestToolContext = {
  config: OpenClawConfig;
  messageChannel: string;
  agentAccountId: string;
  nativeChannelId: string;
  requesterSenderId: string;
  workspaceDir: string;
  agentId: string;
  sessionKey: string;
};

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

function configuredWorkspace(cfg: OpenClawConfig, agentId: string): string {
  const entry = cfg.agents?.entries?.[agentId] as { workspace?: string } | undefined;
  const workspace = entry?.workspace?.trim();
  if (!workspace) {
    throw new Error("resource memory did not configure a native Memory Core workspace");
  }
  return path.resolve(workspace);
}

function nativeManager(params: {
  workspaceDir: string;
  searchRoot: string;
  calls: string[];
}): MemorySearchManager {
  return {
    async search(query): Promise<MemorySearchResult[]> {
      params.calls.push(`search:${query}`);
      const hits: MemorySearchResult[] = [];
      for (const file of await markdownFiles(params.searchRoot)) {
        const text = await readFile(file, "utf8");
        if (text.toLowerCase().includes(query.toLowerCase())) {
          hits.push({
            path: path.relative(params.workspaceDir, file).replaceAll("\\", "/"),
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
    async readFile({ relPath }): Promise<MemoryReadResult> {
      params.calls.push(`read:${relPath}`);
      const target = path.resolve(params.workspaceDir, relPath);
      const text = await readFile(target, "utf8").catch(() => undefined);
      return text === undefined
        ? { status: "not_found", text: "", path: relPath }
        : { status: "ok", text, path: relPath };
    },
    status: () => ({ backend: "builtin", provider: "none", workspaceDir: params.workspaceDir }),
    async sync(options) {
      params.calls.push(
        `sync:${options?.reason ?? "unspecified"}:force=${options?.force === true ? "true" : "false"}`,
      );
    },
    async probeEmbeddingAvailability() {
      return { ok: true };
    },
    async probeVectorAvailability() {
      return false;
    },
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-resource-memory-"));
  const workspaceDir = path.join(root, "workspace");
  await mkdir(workspaceDir, { recursive: true });
  const registry = new SgWorkspaceRegistry(root);
  const groupA = await registry.register({
    platform: "telegram",
    accountId: "default",
    resourceId: "telegram:-100500",
    resourceKind: "group",
  });
  const groupB = await registry.register({
    platform: "telegram",
    accountId: "default",
    resourceId: "telegram:-100600",
    resourceKind: "group",
  });
  const calls: string[] = [];
  const workspaces: string[] = [];
  const loadManager: ResourceMemoryManagerLoader = async ({ cfg, agentId }) => {
    const scopedWorkspace = configuredWorkspace(cfg, agentId);
    workspaces.push(scopedWorkspace);
    return {
      manager: nativeManager({ workspaceDir: scopedWorkspace, searchRoot: root, calls }),
    };
  };
  return { root, workspaceDir, groupA, groupB, calls, workspaces, loadManager };
}

function context(senderId: string, workspaceDir: string, nativeChannelId: string): TestToolContext {
  const direct = !nativeChannelId.includes("-100");
  return {
    config: {},
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId,
    requesterSenderId: senderId,
    workspaceDir,
    agentId: "main",
    sessionKey: direct
      ? `agent:main:telegram:direct:${senderId}`
      : `agent:main:telegram:group:${nativeChannelId}`,
  };
}

function findTool(tools: ReturnType<typeof createResourceMemoryTools>, name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

describe("Phase 8 resource-scoped memory", () => {
  it("requires explicit group-memory requests to use resource tools before confirming success", async () => {
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain(
      "ОБЯЗАТЕЛЬНО вызови соответствующий sg_resource_memory_* инструмент",
    );
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain("запомни → sg_resource_memory_remember");
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain("исправь → sg_resource_memory_search");
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain("затем sg_resource_memory_correct");
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain("экспортируй → sg_resource_memory_export");
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain("переиндексируй → sg_resource_memory_reindex");
    expect(RESOURCE_MEMORY_AGENT_GUIDANCE).toContain(
      "Не подтверждай сохранение, исправление, экспорт или переиндексацию",
    );

    const { root, workspaceDir, loadManager } = await fixture();
    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    for (const name of [
      "sg_resource_memory_remember",
      "sg_resource_memory_correct",
      "sg_resource_memory_export",
      "sg_resource_memory_reindex",
    ]) {
      expect(findTool(tools, name).description).toContain("Do not claim success");
    }
  });

  it("returns a stable entry id and exact resource scope for a saved fact", async () => {
    const { root, workspaceDir, groupA, loadManager } = await fixture();
    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );

    expect(
      details(
        await findTool(tools, "sg_resource_memory_remember").execute("remember", {
          text: "Контракт Phase 9 — память ресурса",
        }),
      ),
    ).toMatchObject({
      saved: true,
      resourceScopeId: groupA.resourceScopeId,
      path: "MEMORY.md",
      entryId: expect.stringMatching(/^rmem-/u),
    });
  });

  it("corrects a resource entry through supersession", async () => {
    const { root, workspaceDir, groupA, loadManager } = await fixture();
    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    const saved = details(
      await findTool(tools, "sg_resource_memory_remember").execute("remember", {
        text: "Групповой статус — закрыт",
      }),
    );

    expect(
      details(
        await findTool(tools, "sg_resource_memory_correct").execute("correct", {
          entryId: saved.entryId,
          text: "Групповой статус — открыт",
        }),
      ),
    ).toMatchObject({
      status: "corrected",
      resourceScopeId: groupA.resourceScopeId,
      supersedesId: saved.entryId,
    });
  });

  it("does not let another resource correct an entry by id", async () => {
    const { root, workspaceDir, loadManager } = await fixture();
    const groupA = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    const groupB = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100600"),
      root,
      loadManager,
    );
    const saved = details(
      await findTool(groupA, "sg_resource_memory_remember").execute("remember", {
        text: "PHASE9-GROUP-A-MUTATION",
      }),
    );

    await expect(
      findTool(groupB, "sg_resource_memory_correct").execute("correct", {
        entryId: saved.entryId,
        text: "unauthorized correction",
      }),
    ).rejects.toThrow(/not-found/iu);
  });

  it("exports and reindexes only the current resource scope", async () => {
    const { root, workspaceDir, groupA, calls, loadManager } = await fixture();
    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    await findTool(tools, "sg_resource_memory_remember").execute("remember", {
      text: "PHASE9-RESOURCE-EXPORT",
    });

    const exported = details(
      await findTool(tools, "sg_resource_memory_export").execute("export", {}),
    );
    expect(exported).toMatchObject({ status: "ok", resourceScopeId: groupA.resourceScopeId });
    expect(JSON.stringify(exported)).toContain("PHASE9-RESOURCE-EXPORT");
    await findTool(tools, "sg_resource_memory_reindex").execute("reindex", {});
    expect(calls).toContain("sync:sg-resource-memory-reindex:force=true");
  });

  it("shares one resource memory between admitted participants in the same group", async () => {
    const { root, workspaceDir, groupA, loadManager } = await fixture();
    const firstParticipant = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    await findTool(firstParticipant, "sg_resource_memory_remember").execute("remember", {
      text: "Общий маркер RESOURCE-SHARED-42",
    });

    const secondParticipant = createResourceMemoryTools(
      context("30", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    expect(
      details(
        await findTool(secondParticipant, "sg_resource_memory_search").execute("search", {
          query: "RESOURCE-SHARED-42",
        }),
      ),
    ).toMatchObject({
      resourceScopeId: groupA.resourceScopeId,
      results: [
        expect.objectContaining({ snippet: expect.stringContaining("RESOURCE-SHARED-42") }),
      ],
    });
  });

  it("does not expose one group resource memory to another group", async () => {
    const { root, workspaceDir, groupB, loadManager } = await fixture();
    const groupA = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    await findTool(groupA, "sg_resource_memory_remember").execute("remember", {
      text: "Закрытый маркер GROUP-A-ONLY-73",
    });

    const otherGroup = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100600"),
      root,
      loadManager,
    );
    expect(
      details(
        await findTool(otherGroup, "sg_resource_memory_search").execute("search", {
          query: "GROUP-A-ONLY-73",
        }),
      ),
    ).toMatchObject({ resourceScopeId: groupB.resourceScopeId, results: [] });
  });

  it("filters personal and monarch project memory out of resource results", async () => {
    const { root, workspaceDir, loadManager } = await fixture();
    const personalFile = path.join(root, "sg", "users", "usr_a", "MEMORY.md");
    const projectFile = path.join(workspaceDir, "memory", "projects", "sg", "MEMORY.md");
    await mkdir(path.dirname(personalFile), { recursive: true });
    await mkdir(path.dirname(projectFile), { recursive: true });
    await writeFile(personalFile, "PERSONAL-SECRET-91\n");
    await writeFile(projectFile, "PROJECT-SECRET-92\n");

    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    for (const query of ["PERSONAL-SECRET-91", "PROJECT-SECRET-92"]) {
      expect(
        details(await findTool(tools, "sg_resource_memory_search").execute("search", { query })),
      ).toMatchObject({ results: [] });
    }
  });

  it("fails closed in a direct message that has no registered resource scope", async () => {
    const { root, workspaceDir, loadManager } = await fixture();
    const filesBefore = await markdownFiles(root);
    const directTools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:20"),
      root,
      loadManager,
    );

    await expect(
      findTool(directTools, "sg_resource_memory_remember").execute("remember", {
        text: "must not be written",
      }),
    ).rejects.toThrow(/resource|scope|group/iu);
    expect(await markdownFiles(root)).toEqual(filesBefore);
  });

  it("uses native Memory Core for write indexing, search, and retrieval", async () => {
    const { root, workspaceDir, groupA, calls, workspaces, loadManager } = await fixture();
    const tools = createResourceMemoryTools(
      context("20", workspaceDir, "telegram:-100500"),
      root,
      loadManager,
    );
    await findTool(tools, "sg_resource_memory_remember").execute("remember", {
      text: "MEMORY-CORE-MARKER-18",
    });
    const searchResult = details(
      await findTool(tools, "sg_resource_memory_search").execute("search", {
        query: "MEMORY-CORE-MARKER-18",
      }),
    );
    const resultPath = (searchResult.results as Array<{ path: string }>)[0]?.path;
    expect(resultPath).toBeTruthy();
    await findTool(tools, "sg_resource_memory_get").execute("get", { path: resultPath });

    expect(new Set(workspaces).size).toBe(1);
    expect(workspaces[0]).toContain(groupA.resourceScopeId);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^sync:/u),
        "search:MEMORY-CORE-MARKER-18",
        expect.stringMatching(/^read:/u),
      ]),
    );
  });
});
