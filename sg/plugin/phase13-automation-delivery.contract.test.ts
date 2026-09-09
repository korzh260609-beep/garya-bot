import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("SG native scheduled Telegram delivery contract", () => {
  it("requires a deliverable result for mandatory private notifications", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("## Scheduled Telegram delivery");
    expect(agents).toContain("sessionTarget: current");
    expect(agents).toContain("payload.kind: agentTurn");
    expect(agents).toContain("delivery.mode: announce");
    expect(agents).toContain("channel: telegram");
    expect(agents).toContain("current private Telegram chat ID");
    expect(agents).toContain("required notification");
    expect(agents).toContain("must return the actual notification text");
    expect(agents).toContain("must not return `HEARTBEAT_OK` or `NO_REPLY`");
  });

  it("keeps silent heartbeat valid only for conditional checks", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("conditional check");
    expect(agents).toContain("may return `HEARTBEAT_OK` only when there is nothing to notify");
  });
});
