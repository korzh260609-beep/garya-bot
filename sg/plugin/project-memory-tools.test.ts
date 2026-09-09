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
  createProjectMemoryTools,
  type ProjectMemoryManagerLoader,
} from "./project-memory-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-project-memory-"));
  const workspaceDir = path.join(root, "workspace");
  await mkdir(path.join(root, "sg"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:10",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_citizen",
          canonicalIdentity: "channel:telegram:20",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:10",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "channel:telegram:20",
          globalId: "usr_citizen",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
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

function nativeManager(workspaceDir: string): MemorySearchManager {
  return {
    async search(query): Promise<MemorySearchResult[]> {
      const hits: MemorySearchResult[] = [];
      for (const file of await markdownFiles(path.join(workspaceDir, "memory"))) {
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
    async readFile({ relPath }): Promise<MemoryReadResult> {
      const target = path.resolve(workspaceDir, relPath);
      const text = await readFile(target, "utf8").catch(() => undefined);
      return text === undefined
        ? { status: "not_found", text: "", path: relPath }
        : { status: "ok", text, path: relPath };
    },
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

function loader(manager: MemorySearchManager): ProjectMemoryManagerLoader {
  return async () => ({ manager });
}

function context(senderId: string, workspaceDir: string, group = false) {
  return {
    config: {},
    messageChannel: "telegram",
    nativeChannelId: group ? "telegram:-100500" : `telegram:${senderId}`,
    requesterSenderId: senderId,
    workspaceDir,
    agentId: "main",
    sessionKey: group
      ? "agent:main:telegram:group:-100500"
      : `agent:main:telegram:direct:${senderId}`,
  };
}

function findTool(
  tools: ReturnType<typeof createProjectMemoryTools>,
  name: string,
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function details(result: unknown): Record<string, any> {
  return (result as { details: Record<string, any> }).details;
}

describe("SG Project Memory 3.0 over OpenClaw Memory Core", () => {
  it("stores a reasoned decision and finds it across Monarch DM and group turns", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir);
    const record = findTool(
      createProjectMemoryTools(context("10", workspaceDir), root, loader(manager)),
      "sg_project_memory_record",
    );
    const created = details(
      await record.execute("record", {
        recordType: "decision",
        title: "Use Memory Core",
        summary: "PM3 uses the native OpenClaw memory index.",
        rationale: "Avoid a parallel memory engine.",
        sourceRefs: ["owner-approved:2026-09-09"],
      }),
    );
    expect(created).toMatchObject({
      status: "created",
      record: {
        recordType: "decision",
        actorGlobalId: "usr_monarch",
        sourceRefs: ["owner-approved:2026-09-09"],
      },
    });

    const search = findTool(
      createProjectMemoryTools(context("10", workspaceDir, true), root, loader(manager)),
      "sg_project_memory_search",
    );
    expect(
      details(await search.execute("search", { query: "parallel memory engine" })),
    ).toMatchObject({
      status: "ok",
      results: [
        expect.objectContaining({
          title: "Use Memory Core",
          effectiveStatus: "active",
        }),
      ],
    });
  });

  it("fails closed for a citizen at write, search, and read boundaries", async () => {
    const { root, workspaceDir } = await fixture();
    const tools = createProjectMemoryTools(
      context("20", workspaceDir),
      root,
      loader(nativeManager(workspaceDir)),
    );
    for (const [name, params] of [
      [
        "sg_project_memory_record",
        { recordType: "incident", title: "Denied", summary: "Must not be written" },
      ],
      ["sg_project_memory_search", { query: "anything" }],
      ["sg_project_memory_get", { recordId: "pm3-missing" }],
    ] as const) {
      expect(details(await findTool(tools, name).execute("denied", params))).toMatchObject({
        status: "denied",
        reason: expect.stringContaining("monarch"),
      });
    }
    expect(await markdownFiles(path.join(workspaceDir, "memory"))).toEqual([]);
  });

  it("preserves immutable history and resolves the current superseding record", async () => {
    const { root, workspaceDir } = await fixture();
    const manager = nativeManager(workspaceDir);
    const tools = createProjectMemoryTools(
      context("10", workspaceDir),
      root,
      loader(manager),
    );
    const record = findTool(tools, "sg_project_memory_record");
    const first = details(
      await record.execute("first", {
        recordType: "decision",
        title: "Initial decision",
        summary: "Use option A.",
        rationale: "Initial evidence.",
      }),
    ).record;
    const second = details(
      await record.execute("second", {
        recordType: "decision",
        title: "Revised decision",
        summary: "Use option B instead of option A.",
        rationale: "New verified evidence.",
        supersedesId: first.id,
      }),
    ).record;

    const search = findTool(tools, "sg_project_memory_search");
    const current = details(
      await search.execute("current", { query: "option", includeSuperseded: false }),
    );
    expect(current.results.map((entry: { id: string }) => entry.id)).toEqual([second.id]);

    const historical = details(
      await search.execute("history", { query: "option", includeSuperseded: true }),
    );
    expect(historical.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          effectiveStatus: "superseded",
          supersededBy: second.id,
        }),
        expect.objectContaining({
          id: second.id,
          effectiveStatus: "active",
          supersedesId: first.id,
        }),
      ]),
    );
    expect(await readFile(path.join(workspaceDir, first.path), "utf8")).toContain(
      "Initial evidence.",
    );
  });

  it("keeps incidents and OpenClaw task references after a simulated restart", async () => {
    const { root, workspaceDir } = await fixture();
    const firstManager = nativeManager(workspaceDir);
    const firstTools = createProjectMemoryTools(
      context("10", workspaceDir),
      root,
      loader(firstManager),
    );
    await findTool(firstTools, "sg_project_memory_record").execute("incident", {
      recordType: "incident",
      title: "Context failure",
      summary: "Compaction failed and was repaired.",
      status: "resolved",
      sourceRefs: ["github:commit/example"],
    });
    const task = details(
      await findTool(firstTools, "sg_project_memory_record").execute("task", {
        recordType: "task",
        title: "Verify deployment",
        summary: "Run live verification after image deployment.",
        runtimeTaskId: "task-123",
        runtimeFlowId: "flow-456",
      }),
    ).record;

    const restarted = createProjectMemoryTools(
      context("10", workspaceDir),
      root,
      loader(nativeManager(workspaceDir)),
    );
    const fetched = details(
      await findTool(restarted, "sg_project_memory_get").execute("get", {
        recordId: task.id,
      }),
    );
    expect(fetched).toMatchObject({
      status: "ok",
      record: {
        runtimeTaskId: "task-123",
        runtimeFlowId: "flow-456",
      },
      text: expect.stringContaining("Verify deployment"),
    });
  });

  it("does not search outside the native project-memory subtree", async () => {
    const { root, workspaceDir } = await fixture();
    await mkdir(path.join(workspaceDir, "memory"), { recursive: true });
    await writeFile(
      path.join(workspaceDir, "memory", "personal-leak.md"),
      "PRIVATE-PERSONAL-MARKER",
    );
    const tools = createProjectMemoryTools(
      context("10", workspaceDir),
      root,
      loader(nativeManager(workspaceDir)),
    );
    expect(
      details(
        await findTool(tools, "sg_project_memory_search").execute("search", {
          query: "PRIVATE-PERSONAL-MARKER",
        }),
      ),
    ).toMatchObject({ status: "ok", results: [] });
  });

  it("requires rationale for decisions and rejects cross-type supersession", async () => {
    const { root, workspaceDir } = await fixture();
    const tools = createProjectMemoryTools(
      context("10", workspaceDir),
      root,
      loader(nativeManager(workspaceDir)),
    );
    const record = findTool(tools, "sg_project_memory_record");
    expect(
      details(
        await record.execute("missing-rationale", {
          recordType: "decision",
          title: "Incomplete",
          summary: "No reason supplied.",
        }),
      ),
    ).toMatchObject({
      status: "denied",
      reason: expect.stringContaining("rationale"),
    });
    const incident = details(
      await record.execute("incident", {
        recordType: "incident",
        title: "Incident",
        summary: "Observed failure.",
      }),
    ).record;
    expect(
      details(
        await record.execute("bad-supersession", {
          recordType: "task",
          title: "Task",
          summary: "Must not replace an incident.",
          supersedesId: incident.id,
        }),
      ),
    ).toMatchObject({
      status: "denied",
      reason: expect.stringContaining("type-mismatch"),
    });
  });

  it("keeps native sender-policy and project tools Monarch-only in Render config", async () => {
    const entrypoint = await readFile("scripts/sg22-render-entrypoint.sh", "utf8");
    for (const toolName of [
      "sg_project_memory_record",
      "sg_project_memory_search",
      "sg_project_memory_get",
    ]) {
      expect(entrypoint).toContain(toolName);
      expect(entrypoint.split(toolName)).toHaveLength(4);
    }
    expect(entrypoint).not.toContain("memory-wiki");
  });
});
