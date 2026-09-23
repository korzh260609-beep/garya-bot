import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhase11CapabilityTools } from "./phase11-capability-tools.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-phase11-tools-"));
  const bin = path.join(root, "bin");
  await mkdir(path.join(root, "sg"), { recursive: true });
  await mkdir(bin, { recursive: true });
  const users = [
    ["usr_alice", "20"],
    ["usr_bob", "30"],
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
  await executable(
    path.join(bin, "blogwatcher"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const target = process.env.BLOGWATCHER_DB;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.appendFileSync(target, JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdout.write(JSON.stringify({ target, args: process.argv.slice(2) }));
`,
  );
  await executable(
    path.join(bin, "songsee"),
    `#!/usr/bin/env node
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  if (Buffer.concat(chunks).length === 0) process.exit(2);
  process.stdout.write(Buffer.from("${tinyPng}", "base64"));
});
`,
  );
  vi.stubEnv("PATH", `${bin}${path.delimiter}${process.env.PATH ?? ""}`);
  vi.stubEnv("OPENCLAW_STATE_DIR", root);
  return { root };
}

async function executable(target: string, source: string): Promise<void> {
  await writeFile(target, source);
  await chmod(target, 0o755);
}

function context(senderId: string): OpenClawPluginToolContext {
  return {
    config: {},
    messageChannel: "telegram",
    agentAccountId: "default",
    nativeChannelId: senderId,
    requesterSenderId: senderId,
    sessionKey: `agent:main:telegram:direct:${senderId}`,
  };
}

function findTool(
  tools: ReturnType<typeof createPhase11CapabilityTools>,
  name: "sg_blogwatcher" | "sg_songsee",
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function details(result: unknown): Record<string, unknown> {
  return (result as { details: Record<string, unknown> }).details;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Phase 11 multi-user capability tools", () => {
  it("derives isolated Blogwatcher databases from trusted sender Global IDs", async () => {
    const { root } = await fixture();
    const alice = findTool(createPhase11CapabilityTools(context("20"), root), "sg_blogwatcher");
    const bob = findTool(createPhase11CapabilityTools(context("30"), root), "sg_blogwatcher");

    const aliceResult = details(
      await alice.execute("alice", { action: "list", globalId: "usr_bob" }),
    );
    const bobResult = details(await bob.execute("bob", { action: "list" }));

    expect(aliceResult).toMatchObject({ status: "ok", action: "blogs" });
    expect(bobResult).toMatchObject({ status: "ok", action: "blogs" });
    expect(String(aliceResult.output)).toContain("/sg/users/usr_alice/blogwatcher/blogwatcher.db");
    expect(String(bobResult.output)).toContain("/sg/users/usr_bob/blogwatcher/blogwatcher.db");
    expect(
      await readFile(
        path.join(root, "sg", "users", "usr_alice", "blogwatcher", "blogwatcher.db"),
        "utf8",
      ),
    ).toContain('["blogs"]');
    expect(
      await readFile(
        path.join(root, "sg", "users", "usr_bob", "blogwatcher", "blogwatcher.db"),
        "utf8",
      ),
    ).toContain('["blogs"]');
  });

  it("rejects Blogwatcher URLs that target private networks", async () => {
    const { root } = await fixture();
    const tool = findTool(createPhase11CapabilityTools(context("20"), root), "sg_blogwatcher");

    expect(
      details(
        await tool.execute("private", {
          action: "add",
          name: "private",
          url: "http://127.0.0.1/feed.xml",
        }),
      ),
    ).toMatchObject({ status: "denied" });
  });

  it("streams protected inbound audio to Songsee and returns a native image result", async () => {
    const { root } = await fixture();
    const inbound = path.join(root, "media", "inbound");
    await mkdir(inbound, { recursive: true });
    await writeFile(path.join(inbound, "voice.wav"), Buffer.from("audio-fixture"));
    const tool = findTool(createPhase11CapabilityTools(context("20"), root), "sg_songsee");

    const result = await tool.execute("songsee", {
      audio: "media://inbound/voice.wav",
      visualizations: ["spectrogram", "mel"],
      style: "magma",
      width: 800,
      height: 600,
    });

    expect(result.content).toContainEqual({
      type: "image",
      data: tinyPng,
      mimeType: "image/png",
    });
    expect(details(result)).toMatchObject({ status: "ok", format: "png" });
  });

  it("rejects Songsee traversal and non-inbound media references before spawning", async () => {
    const { root } = await fixture();
    const tool = findTool(createPhase11CapabilityTools(context("20"), root), "sg_songsee");

    for (const audio of [
      "media://inbound/nested%2Fvoice.wav",
      "media://outbound/voice.wav",
      "file:///tmp/voice.wav",
      "https://example.com/voice.wav",
    ]) {
      expect(details(await tool.execute("unsafe", { audio }))).toMatchObject({
        status: "denied",
        reason: "audio-media-reference-invalid",
      });
    }
  });
});
