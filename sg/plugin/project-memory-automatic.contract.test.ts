import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  MemoryReadResult,
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryHost = vi.hoisted(() => ({
  manager: undefined as MemorySearchManager | undefined,
}));

vi.mock("openclaw/plugin-sdk/memory-host-search", () => ({
  getActiveMemorySearchManager: async () => ({
    manager: memoryHost.manager ?? null,
    ...(memoryHost.manager ? {} : { error: "test-manager-unavailable" }),
  }),
}));

import {
  createProjectHandoffTool,
  validateCanonicalProjectMemoryBootstrap,
} from "./project-memory-automatic.js";
import { registerWorkspaceManager } from "./register.js";

const timestamp = "2026-09-17T00:00:00.000Z";
const projectRoot = "memory/projects/sg";

type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

type RegisteredPlugin = {
  hooks: Map<string, HookHandler[]>;
  registeredToolNames: string[];
  stateDir: string;
  workspaceDir: string;
};

const bootstrapRecordCount = 14;

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

async function projectRecords(workspaceDir: string): Promise<string[]> {
  const files = await markdownFiles(path.join(workspaceDir, projectRoot));
  return Promise.all(files.map((file) => readFile(file, "utf8")));
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
      const text = await readFile(path.resolve(workspaceDir, relPath), "utf8").catch(
        () => undefined,
      );
      return text === undefined
        ? { status: "not_found", text: "", path: relPath }
        : { status: "ok", text, path: relPath };
    },
    status: () => ({ backend: "builtin", provider: "none", workspaceDir }),
    sync: vi.fn(async () => {}),
    async probeEmbeddingAvailability() {
      return { ok: true };
    },
    async probeVectorAvailability() {
      return false;
    },
  };
}

async function registerPlugin(existingStateDir?: string): Promise<RegisteredPlugin> {
  const stateDir =
    existingStateDir ?? (await mkdtemp(path.join(os.tmpdir(), "sg-project-memory-auto-")));
  const workspaceDir = path.join(stateDir, "workspace");
  await mkdir(path.join(stateDir, "sg"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(
    path.join(stateDir, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 5,
      monarchGlobalId: "usr_monarch",
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          globalId: "usr_citizen",
          canonicalIdentity: "channel:telegram:200",
          role: "citizen",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          canonicalIdentity: "channel:telegram:200",
          globalId: "usr_citizen",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
  );
  memoryHost.manager = nativeManager(workspaceDir);
  const hooks = new Map<string, HookHandler[]>();
  const registeredToolNames: string[] = [];
  registerWorkspaceManager({
    config: {},
    registerCommand: vi.fn(),
    registerTool: vi.fn((_factory, options?: { names?: string[] }) => {
      registeredToolNames.push(...(options?.names ?? []));
    }),
    on: vi.fn((name: string, handler: HookHandler) => {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    }),
    logger: { info: vi.fn(), warn: vi.fn() },
    runtime: { state: { resolveStateDir: () => stateDir } },
  });
  return { hooks, registeredToolNames, stateDir, workspaceDir };
}

async function runHooks(
  plugin: RegisteredPlugin,
  name: string,
  event: Record<string, unknown>,
  ctx: Record<string, unknown>,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const handler of plugin.hooks.get(name) ?? []) {
    results.push(await handler(event, ctx));
  }
  return results;
}

function monarchAgentContext(plugin: RegisteredPlugin, runId: string) {
  return {
    runId,
    agentId: "main",
    sessionId: `session-${runId}`,
    sessionKey: "agent:main:telegram:direct:100",
    workspaceDir: plugin.workspaceDir,
    channel: "telegram",
    messageProvider: "telegram",
    accountId: "default",
    conversationId: "telegram:100",
    channelId: "telegram:100",
    senderId: "100",
    activeProjectKeys: ["project-sg"],
  };
}

function trustedHandoff(eventIdPrefix = "handoff-1") {
  return {
    schemaVersion: 1,
    handoffId: eventIdPrefix,
    projectKey: "project-sg",
    authority: { kind: "monarch-approved", globalId: "usr_monarch" },
    events: [
      {
        eventId: `${eventIdPrefix}:decision`,
        eventType: "decision.approved",
        recordType: "decision",
        title: "Automatic Project Memory is mandatory",
        summary: "Project decisions must be captured without a remember command.",
        rationale: "The Monarch approved automatic project memory.",
        status: "active",
        sourceRefs: ["owner-approved:2026-09-17"],
      },
      {
        eventId: `${eventIdPrefix}:task`,
        eventType: "task.created",
        recordType: "task",
        title: "Implement automatic Project Memory",
        summary: "Implement the approved automatic capture and recall contract.",
        status: "planned",
        sourceRefs: ["roadmap:SG22_FULL_OPENCLAW_CAPABILITY_INHERITANCE.md"],
      },
      {
        eventId: `${eventIdPrefix}:commit`,
        eventType: "commit.verified",
        recordType: "task",
        title: "Automatic Project Memory code committed",
        summary: "The task reached a verified repository commit.",
        status: "in_progress",
        supersedesEventId: `${eventIdPrefix}:task`,
        sourceRefs: ["github:commit:0123456789abcdef0123456789abcdef01234567"],
      },
      {
        eventId: `${eventIdPrefix}:actions`,
        eventType: "actions.completed",
        recordType: "task",
        title: "Automatic Project Memory CI passed",
        summary: "GitHub Actions verified the exact commit.",
        status: "in_progress",
        supersedesEventId: `${eventIdPrefix}:commit`,
        sourceRefs: ["github:actions:298:success"],
      },
      {
        eventId: `${eventIdPrefix}:deploy`,
        eventType: "deploy.live",
        recordType: "task",
        title: "Automatic Project Memory deployed",
        summary: "Render reported the verified image live.",
        status: "done",
        supersedesEventId: `${eventIdPrefix}:actions`,
        sourceRefs: ["render:deploy:dep-example:live"],
      },
      {
        eventId: `${eventIdPrefix}:incident`,
        eventType: "incident.opened",
        recordType: "incident",
        title: "Project Memory remained empty",
        summary: "Normal project work produced no automatic project records.",
        status: "open",
        sourceRefs: ["observation:project-memory-empty"],
      },
      {
        eventId: `${eventIdPrefix}:fix`,
        eventType: "incident.fixed",
        recordType: "incident",
        title: "Automatic capture repaired",
        summary: "The incident was fixed and verified.",
        status: "resolved",
        supersedesEventId: `${eventIdPrefix}:incident`,
        sourceRefs: ["github:commit:fedcba9876543210fedcba9876543210fedcba98"],
      },
    ],
  };
}

async function deliverHandoff(
  plugin: RegisteredPlugin,
  handoff: Record<string, unknown>,
  senderId = "100",
) {
  const runId = `run-${String(handoff.handoffId ?? "unknown")}-${senderId}`;
  const agentContext = {
    ...monarchAgentContext(plugin, runId),
    senderId,
    sessionKey: `agent:main:telegram:direct:${senderId}`,
    conversationId: `telegram:${senderId}`,
  };
  await runHooks(
    plugin,
    "before_prompt_build",
    { prompt: "Continue SG project development", messages: [] },
    agentContext,
  );
  await runHooks(
    plugin,
    "after_tool_call",
    {
      toolName: "sg_project_handoff",
      params: {},
      result: { status: "verified", sgProjectMemoryHandoff: handoff },
      runId,
      toolCallId: `tool-${runId}`,
    },
    {
      runId,
      agentId: "main",
      sessionKey: agentContext.sessionKey,
      toolName: "sg_project_handoff",
      requester: {
        channel: "telegram",
        accountId: "default",
        senderId,
        senderIsOwner: senderId === "100",
      },
    },
  );
  await runHooks(plugin, "agent_end", { runId, messages: [], success: true }, agentContext);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  memoryHost.manager = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not found", { status: 404 })),
  );
});

describe("automatic SG Project Memory 3.0 contract", () => {
  it("registers the trusted project handoff tool used by the live bridge", async () => {
    const plugin = await registerPlugin();

    expect(plugin.registeredToolNames).toContain("sg_project_handoff");
  });

  it("executes the registered bridge contract before the automatic recording hook", async () => {
    const plugin = await registerPlugin();
    const handoff = trustedHandoff("real-tool-handoff");
    const runId = "run-real-tool-handoff";
    const agentContext = monarchAgentContext(plugin, runId);
    const tool = createProjectHandoffTool(
      {
        config: {},
        runtimeConfig: {},
        messageChannel: "telegram",
        agentAccountId: "default",
        nativeChannelId: "telegram:100",
        requesterSenderId: "100",
        senderIsOwner: true,
        workspaceDir: plugin.workspaceDir,
        agentId: "main",
        sessionKey: agentContext.sessionKey,
        activeProjectKeys: ["project-sg"],
      } as never,
      plugin.stateDir,
    );

    const toolResult = await tool.execute("tool-real-handoff", handoff);
    expect(toolResult).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({ status: "verified" }),
      }),
    );

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Continue SG project development", messages: [] },
      agentContext,
    );
    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "sg_project_handoff",
        params: handoff,
        result: toolResult,
        runId,
        toolCallId: "tool-real-handoff",
      },
      {
        runId,
        agentId: "main",
        sessionKey: agentContext.sessionKey,
        toolName: "sg_project_handoff",
        requester: {
          channel: "telegram",
          accountId: "default",
          senderId: "100",
          senderIsOwner: true,
        },
      },
    );

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount + 7);
    expect(records.join("\n")).toContain("real-tool-handoff:deploy");
  });

  it("ingests a trusted external Codex handoff from the canonical repository before answering", async () => {
    const handoff = {
      ...trustedHandoff("repository-handoff"),
      authority: { kind: "canonical-project-artifact" },
    };
    const manifest = {
      schemaVersion: 1,
      repository: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "dev/sg2.2-openclaw",
      },
      handoffs: [handoff],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          encoding: "base64",
          content: Buffer.from(JSON.stringify(manifest), "utf8").toString("base64"),
        }),
      ),
    );
    const plugin = await registerPlugin();

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Что сделано в проекте SG?", messages: [] },
      monarchAgentContext(plugin, "run-repository-handoff"),
    );

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount + 7);
    expect(records.join("\n")).toContain("repository-handoff:deploy");
  });

  it("discovers commit, Actions and Render lifecycle without a handoff tool call", async () => {
    const commitSha = "1234567890abcdef1234567890abcdef12345678";
    const manifest = {
      schemaVersion: 1,
      repository: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "dev/sg2.2-openclaw",
      },
      handoffs: [],
    };
    vi.stubEnv("RENDER_API_KEY", "test-render-key");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-sg22");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/contents/pillars/project-memory/")) {
          return Response.json({
            encoding: "base64",
            content: Buffer.from(JSON.stringify(manifest), "utf8").toString("base64"),
          });
        }
        if (url.includes("/commits?")) {
          return Response.json([
            {
              sha: commitSha,
              html_url: `https://github.com/korzh260609-beep/garya-bot/commit/${commitSha}`,
              commit: { message: "Complete automatic Project Memory lifecycle" },
            },
          ]);
        }
        if (url.includes("/actions/runs?")) {
          return Response.json({
            workflow_runs: [
              {
                id: 305,
                name: "SG verification",
                status: "completed",
                conclusion: "success",
                head_sha: commitSha,
                html_url: "https://github.com/korzh260609-beep/garya-bot/actions/runs/305",
              },
            ],
          });
        }
        if (url === "https://api.render.com/v1/services/srv-sg22/deploys?limit=20") {
          return Response.json([
            {
              deploy: {
                id: "dep-automatic",
                status: "live",
                commit: { id: commitSha, message: "Complete automatic Project Memory lifecycle" },
              },
            },
          ]);
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const plugin = await registerPlugin();

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Что сделано в проекте SG?", messages: [] },
      monarchAgentContext(plugin, "run-automatic-lifecycle"),
    );

    const records = await projectRecords(plugin.workspaceDir);
    const corpus = records.join("\n");
    expect(records).toHaveLength(bootstrapRecordCount + 3);
    expect(corpus).toContain(`github:commit:${commitSha}`);
    expect(corpus).toContain("github:actions:305:success");
    expect(corpus).toContain("render:deploy:dep-automatic:live");

    const restarted = await registerPlugin(plugin.stateDir);
    await runHooks(
      restarted,
      "before_prompt_build",
      { prompt: "Покажи актуальное состояние проекта SG", messages: [] },
      monarchAgentContext(restarted, "run-automatic-lifecycle-restart"),
    );
    expect(await projectRecords(restarted.workspaceDir)).toHaveLength(bootstrapRecordCount + 3);
  });

  it("records failed Actions and Render deploys as automatic incidents", async () => {
    const commitSha = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    vi.stubEnv("RENDER_API_KEY", "test-render-key");
    vi.stubEnv("RENDER_SERVICE_ID", "srv-sg22");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/contents/pillars/project-memory/")) {
          return new Response("not found", { status: 404 });
        }
        if (url.includes("/commits?")) {
          return Response.json([]);
        }
        if (url.includes("/actions/runs?")) {
          return Response.json({
            workflow_runs: [
              {
                id: 306,
                name: "SG verification",
                status: "completed",
                conclusion: "failure",
                head_sha: commitSha,
              },
            ],
          });
        }
        if (url === "https://api.render.com/v1/services/srv-sg22/deploys?limit=20") {
          return Response.json([
            {
              deploy: {
                id: "dep-failed",
                status: "build_failed",
                commit: { id: commitSha },
              },
            },
          ]);
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const plugin = await registerPlugin();

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Что происходит с проектом SG?", messages: [] },
      monarchAgentContext(plugin, "run-automatic-failures"),
    );

    const records = await projectRecords(plugin.workspaceDir);
    const corpus = records.join("\n");
    expect(records).toHaveLength(bootstrapRecordCount + 2);
    expect(corpus).toContain("github:actions:306:failure");
    expect(corpus).toContain("render:deploy:dep-failed:build_failed");
    const failureRecords = records.filter((record) =>
      /github:actions:306:failure|render:deploy:dep-failed:build_failed/u.test(record),
    );
    expect(failureRecords).toHaveLength(2);
    expect(failureRecords.every((record) => record.includes('"recordType":"incident"'))).toBe(true);
  });

  it("accepts the canonical repository handoff artifact shipped with SG", async () => {
    const content = await readFile(
      path.join(process.cwd(), "pillars/project-memory/SG22_PROJECT_MEMORY_HANDOFFS.json"),
      "utf8",
    );
    const manifest = JSON.parse(content) as {
      handoffs: Array<{ events: unknown[] }>;
    };
    const manifestEventCount = manifest.handoffs.reduce(
      (count, handoff) => count + handoff.events.length,
      0,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          encoding: "base64",
          content: Buffer.from(content, "utf8").toString("base64"),
        }),
      ),
    );
    const plugin = await registerPlugin();

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Покажи состояние Project Memory", messages: [] },
      monarchAgentContext(plugin, "run-canonical-repository-handoff"),
    );

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount + manifestEventCount);
    expect(records.join("\n")).toContain("Automatic Project Memory handoff had no live ingress");
  });

  it("fails closed for a wrong repository branch, chat evidence or secrets", async () => {
    const bootstrap = JSON.parse(
      await readFile(new URL("./project-memory-bootstrap.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;
    expect(validateCanonicalProjectMemoryBootstrap(bootstrap)).toBe(true);

    expect(
      validateCanonicalProjectMemoryBootstrap({
        ...bootstrap,
        repository: {
          fullName: "korzh260609-beep/garya-bot",
          branch: "main",
        },
      }),
    ).toBe(false);

    const events = structuredClone(bootstrap.events) as Array<Record<string, unknown>>;
    events[0] = { ...events[0], sourceRefs: ["chat:bulk-import"] };
    expect(validateCanonicalProjectMemoryBootstrap({ ...bootstrap, events })).toBe(false);

    const secretEvents = structuredClone(bootstrap.events) as Array<Record<string, unknown>>;
    secretEvents[0] = {
      ...secretEvents[0],
      summary: "token=ghp_exampleSecretToken1234567890",
    };
    expect(validateCanonicalProjectMemoryBootstrap({ ...bootstrap, events: secretEvents })).toBe(
      false,
    );
  });

  it("bootstraps sourced history once and preserves deduplication across a plugin restart", async () => {
    const plugin = await registerPlugin();
    const ctx = monarchAgentContext(plugin, "run-bootstrap-first");

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Продолжи проект SG по подтвержденной истории", messages: [] },
      ctx,
    );

    const firstRecords = await projectRecords(plugin.workspaceDir);
    expect(firstRecords).toHaveLength(bootstrapRecordCount);
    const firstCorpus = firstRecords.join("\n");
    expect(firstCorpus).toContain("Project Memory 3.0 is the single project memory system");
    expect(firstCorpus).toContain("Implement automatic Project Memory 3.0");
    expect(firstCorpus).toContain("github:actions:35256153799:success");
    expect(firstCorpus).toContain("render:deploy:dep-dam269gu01pc73b78n3g:live");

    const restarted = await registerPlugin(plugin.stateDir);
    await runHooks(
      restarted,
      "before_prompt_build",
      { prompt: "Покажи подтвержденную историю проекта SG", messages: [] },
      monarchAgentContext(restarted, "run-bootstrap-restart"),
    );

    expect(await projectRecords(restarted.workspaceDir)).toHaveLength(bootstrapRecordCount);
  });

  it("does not bootstrap confirmed project history for a citizen", async () => {
    const plugin = await registerPlugin();
    const ctx = {
      ...monarchAgentContext(plugin, "run-bootstrap-citizen"),
      senderId: "200",
      sessionKey: "agent:main:telegram:direct:200",
      conversationId: "telegram:200",
    };

    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Покажи подтвержденную историю проекта SG", messages: [] },
      ctx,
    );

    expect(await projectRecords(plugin.workspaceDir)).toEqual([]);
  });

  it("captures decisions, task state, commit, Actions, deploy, incident and fix automatically", async () => {
    const plugin = await registerPlugin();

    await deliverHandoff(plugin, trustedHandoff());

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount + 7);
    const corpus = records.join("\n");
    expect(corpus).toContain("Automatic Project Memory is mandatory");
    expect(corpus).toContain("github:commit:0123456789abcdef0123456789abcdef01234567");
    expect(corpus).toContain("github:actions:298:success");
    expect(corpus).toContain("render:deploy:dep-example:live");
    expect(corpus).toContain("Project Memory remained empty");
    expect(corpus).toContain("Automatic capture repaired");
    expect(corpus.match(/"supersedesId"/gu)).toHaveLength(4);
  });

  it("does not let a project-changing run finish without its semantic handoff", async () => {
    const plugin = await registerPlugin();
    const runId = "run-semantic-handoff-required";
    const ctx = monarchAgentContext(plugin, runId);
    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Реализуй утвержденную задачу проекта SG", messages: [] },
      ctx,
    );
    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "apply_patch",
        params: { patch: "test patch" },
        result: { status: "ok" },
        runId,
      },
      { runId, sessionKey: ctx.sessionKey, toolName: "apply_patch" },
    );

    const finalizeEvent = {
      runId,
      sessionId: `session-${runId}`,
      sessionKey: ctx.sessionKey,
      stopHookActive: false,
      lastAssistantMessage: "Задача реализована.",
    };
    expect(await runHooks(plugin, "before_agent_finalize", finalizeEvent, ctx)).toEqual([
      expect.objectContaining({
        action: "revise",
        reason: expect.stringContaining("handoff"),
      }),
    ]);
  });

  it("deduplicates replayed evidence and rejects citizens, unapproved proposals and secrets", async () => {
    const plugin = await registerPlugin();
    const accepted = trustedHandoff("stable-handoff");

    await deliverHandoff(plugin, accepted);
    await deliverHandoff(plugin, accepted);
    await deliverHandoff(plugin, trustedHandoff("citizen-handoff"), "200");
    await deliverHandoff(plugin, {
      ...trustedHandoff("unapproved-handoff"),
      authority: { kind: "model-proposal" },
    });
    await deliverHandoff(plugin, {
      ...trustedHandoff("secret-handoff"),
      events: [
        {
          eventId: "secret-handoff:task",
          eventType: "task.created",
          recordType: "task",
          title: "Leaked credential",
          summary: "Never store ghp_exampleSecretToken1234567890 in project memory.",
          status: "planned",
          sourceRefs: ["chat:untrusted"],
        },
      ],
    });

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount + 7);
    expect(records.join("\n")).not.toContain("ghp_exampleSecretToken1234567890");
    expect(records.join("\n")).not.toContain("citizen-handoff");
    expect(records.join("\n")).not.toContain("unapproved-handoff");
  });

  it("recalls relevant active project records before a Monarch project answer", async () => {
    const plugin = await registerPlugin();
    const directory = path.join(plugin.workspaceDir, projectRoot, "decisions");
    await mkdir(directory, { recursive: true });
    const metadata = {
      schemaVersion: 1,
      id: "pm3-existing",
      lineageId: "pm3-existing",
      recordType: "decision",
      title: "Use native Memory Core",
      status: "active",
      actorGlobalId: "usr_monarch",
      recordedAt: timestamp,
      channel: "telegram",
      senderId: "100",
      projectKeys: ["project-sg"],
      sourceRefs: ["owner-approved:2026-09-17"],
    };
    await writeFile(
      path.join(directory, "pm3-existing.md"),
      `<!-- sg-project-memory:${JSON.stringify(metadata)} -->\n<!-- project: project-sg -->\n# Use native Memory Core\n\n## Summary\nDo not create a parallel memory database.\n`,
    );

    const results = await runHooks(
      plugin,
      "before_prompt_build",
      {
        prompt: "Как должна работать проектная память и можно ли сделать вторую базу?",
        messages: [],
      },
      monarchAgentContext(plugin, "run-recall"),
    );
    const injected = results
      .flatMap((result) =>
        result && typeof result === "object"
          ? [
              (result as { prependContext?: string }).prependContext,
              (result as { prependSystemContext?: string }).prependSystemContext,
            ]
          : [],
      )
      .filter((value): value is string => typeof value === "string")
      .join("\n");

    expect(injected).toContain("Use native Memory Core");
    expect(injected).toContain("Do not create a parallel memory database.");
  });

  it("requires live GitHub and Render proof before presenting mutable memory as current", async () => {
    const plugin = await registerPlugin();
    await deliverHandoff(plugin, trustedHandoff("live-proof"));
    const ctx = {
      ...monarchAgentContext(plugin, "run-live-proof"),
      toolAuthority: {
        fingerprint: "authority-live-proof",
        allows: (name: string) => name === "exec" || name === "sg_render",
        assertActive: vi.fn(),
      },
    };
    const recallResults = await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Какой сейчас HEAD, статус GitHub Actions и live deploy Render?", messages: [] },
      ctx,
    );
    const injected = JSON.stringify(recallResults);
    expect(injected).toContain("Историческая память");
    expect(injected).toContain("не является доказательством текущего состояния");

    const finalizeEvent = {
      runId: "run-live-proof",
      sessionId: "session-run-live-proof",
      sessionKey: ctx.sessionKey,
      stopHookActive: false,
      lastAssistantMessage: "HEAD и deploy сейчас подтверждены.",
    };
    const beforeProof = await runHooks(plugin, "before_agent_finalize", finalizeEvent, ctx);
    expect(beforeProof).toEqual([
      expect.objectContaining({
        action: "revise",
        retry: expect.objectContaining({ maxAttempts: 1 }),
      }),
    ]);

    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "exec",
        params: { command: "echo not-a-project-proof" },
        result: { exitCode: 0, output: "not valid read-only proof" },
        runId: "run-live-proof",
      },
      { runId: "run-live-proof", sessionKey: ctx.sessionKey, toolName: "exec" },
    );
    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "sg_render",
        params: { action: "status" },
        result: { status: "ready" },
        runId: "run-live-proof",
      },
      { runId: "run-live-proof", sessionKey: ctx.sessionKey, toolName: "sg_render" },
    );
    expect(await runHooks(plugin, "before_agent_finalize", finalizeEvent, ctx)).toEqual([
      expect.objectContaining({ action: "revise" }),
    ]);

    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "exec",
        params: { command: "git rev-parse HEAD && gh run list --limit 1" },
        result: { exitCode: 0, output: "verified" },
        runId: "run-live-proof",
      },
      { runId: "run-live-proof", sessionKey: ctx.sessionKey, toolName: "exec" },
    );
    await runHooks(
      plugin,
      "after_tool_call",
      {
        toolName: "sg_render",
        params: { action: "get_deploy", deployId: "dep-example" },
        result: { status: "ok", data: { status: "live" } },
        runId: "run-live-proof",
      },
      { runId: "run-live-proof", sessionKey: ctx.sessionKey, toolName: "sg_render" },
    );

    expect(await runHooks(plugin, "before_agent_finalize", finalizeEvent, ctx)).toEqual([
      undefined,
    ]);
  });

  it("registers startup synchronization for missed authoritative project events", async () => {
    const plugin = await registerPlugin();

    expect(plugin.hooks.get("gateway_start")).toEqual([expect.any(Function)]);
    await runHooks(plugin, "gateway_start", { port: 18_789 }, { config: {} });
    expect(memoryHost.manager?.sync).toHaveBeenCalledWith({
      reason: "sg-project-memory-startup",
      force: true,
    });
  });

  it("does not turn ordinary chat into confirmed project memory", async () => {
    const plugin = await registerPlugin();
    const ctx = monarchAgentContext(plugin, "run-casual-chat");
    await runHooks(
      plugin,
      "before_prompt_build",
      { prompt: "Мне кажется, можно когда-нибудь переписать всю память.", messages: [] },
      ctx,
    );
    await runHooks(
      plugin,
      "agent_end",
      {
        runId: "run-casual-chat",
        messages: [
          { role: "user", content: "Мне кажется, можно когда-нибудь переписать всю память." },
        ],
        success: true,
      },
      ctx,
    );

    const records = await projectRecords(plugin.workspaceDir);
    expect(records).toHaveLength(bootstrapRecordCount);
    expect(records.join("\n")).not.toContain("переписать всю память");
  });
});
