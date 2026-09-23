import { spawn } from "node:child_process";
import path from "node:path";
import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { resolveWorkspaceContext } from "./context.js";
import { resolvePersonalWorkspaceRoot } from "./personal-workspace.js";

export const PHASE11_CAPABILITY_TOOL_NAMES = ["sg_blogwatcher", "sg_songsee"] as const;

export const PHASE11_CAPABILITY_AGENT_GUIDANCE = [
  "SG — общедоступные локальные возможности",
  "Blogwatcher доступен через sg_blogwatcher: подписки и статьи изолированы по Global ID.",
  "Songsee доступен через sg_songsee: передавай только media://inbound/... из текущего сообщения.",
].join("\n");

const MAX_TEXT_OUTPUT_BYTES = 128 * 1024;
const MAX_IMAGE_OUTPUT_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_INPUT_BYTES = 50 * 1024 * 1024;
const BLOGWATCHER_TIMEOUT_MS = 120_000;
const SONGSEE_TIMEOUT_MS = 120_000;
const SONGSEE_STYLES = ["classic", "magma", "inferno", "viridis", "gray"] as const;
const SONGSEE_VISUALIZATIONS = [
  "spectrogram",
  "mel",
  "chroma",
  "hpss",
  "selfsim",
  "loudness",
  "tempogram",
  "mfcc",
  "flux",
] as const;

type ProcessResult = {
  stdout: Buffer;
  stderr: Buffer;
};

type Phase11Actor = {
  globalId: string;
  personalRoot: string;
};

const blogwatcherLocks = new Map<string, Promise<void>>();
let songseeLock: Promise<void> = Promise.resolve();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredString(
  params: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key}-required`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`${key}-too-long`);
  }
  return normalized;
}

function optionalString(
  params: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string | undefined {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key}-invalid`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`${key}-too-long`);
  }
  return normalized;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  key: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${key}-invalid`);
  }
  return value as number;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  key: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${key}-invalid`);
  }
  return value;
}

async function resolveActor(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
): Promise<Phase11Actor> {
  const actor = await resolveWorkspaceContext(
    {
      channel: ctx.messageChannel ?? "",
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      messageThreadId: ctx.deliveryContext?.threadId,
      senderId: ctx.requesterSenderId,
      identityLinks: ctx.config?.session?.identityLinks,
    },
    stateDir,
  );
  if (!actor.globalId) {
    throw new Error("citizen-global-id-required");
  }
  return {
    globalId: actor.globalId,
    personalRoot: resolvePersonalWorkspaceRoot(stateDir, actor.globalId),
  };
}

async function withNamedLock<T>(
  locks: Map<string, Promise<void>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  locks.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(key) === tail) {
      locks.delete(key);
    }
  }
}

async function withSongseeLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = songseeLock;
  let release = () => {};
  songseeLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function runProcess(params: {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  input?: Buffer;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes?: number;
}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      env: params.env ?? process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const maxStderrBytes = params.maxStderrBytes ?? MAX_TEXT_OUTPUT_BYTES;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      }
    };
    const stopForLimit = (stream: "stdout" | "stderr") => {
      child.kill("SIGKILL");
      finish(new Error(`${params.command}-${stream}-too-large`));
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > params.maxStdoutBytes) {
        stopForLimit("stdout");
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > maxStderrBytes) {
        stopForLimit("stderr");
        return;
      }
      stderr.push(chunk);
    });
    child.stdin.on("error", () => {
      // Process exit owns the user-visible failure; a late EPIPE must not escape the tool call.
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      const diagnostic = Buffer.concat(stderr).toString("utf8").trim().slice(0, 8_000);
      finish(
        new Error(
          `${params.command}-failed:${code ?? signal ?? "unknown"}${diagnostic ? `:${diagnostic}` : ""}`,
        ),
      );
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${params.command}-timeout`));
    }, params.timeoutMs);
    timer.unref();
    if (params.input) {
      child.stdin.end(params.input);
    } else {
      child.stdin.end();
    }
  });
}

async function validatePublicUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("url-invalid");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("url-public-http-required");
  }
  const { resolvePinnedHostnameWithPolicy } = await import("openclaw/plugin-sdk/ssrf-runtime");
  await resolvePinnedHostnameWithPolicy(url.hostname);
  return url.toString();
}

function blogwatcherArgs(params: Record<string, unknown>): Promise<string[]> {
  const action = requiredString(params, "action", 32);
  switch (action) {
    case "add":
      return validatePublicUrl(requiredString(params, "url", 2_048)).then((url) => [
        "add",
        requiredString(params, "name", 120),
        url,
      ]);
    case "list":
      return Promise.resolve(["blogs"]);
    case "scan": {
      const name = optionalString(params, "name", 120);
      return Promise.resolve(["scan", "--workers", "1", ...(name ? [name] : [])]);
    }
    case "articles": {
      const args = ["articles"];
      if (params.includeRead === true) {
        args.push("--all");
      }
      const name = optionalString(params, "name", 120);
      if (name) {
        args.push("--blog", name);
      }
      return Promise.resolve(args);
    }
    case "read":
      return Promise.resolve([
        "read",
        String(boundedInteger(params.articleId, 0, 1, Number.MAX_SAFE_INTEGER, "articleId")),
      ]);
    case "read_all": {
      const args = ["read-all", "--yes"];
      const name = optionalString(params, "name", 120);
      if (name) {
        args.push("--blog", name);
      }
      return Promise.resolve(args);
    }
    case "remove":
      return Promise.resolve(["remove", "--yes", requiredString(params, "name", 120)]);
    default:
      throw new Error("action-unsupported");
  }
}

function mediaId(reference: string): string {
  let parsed: URL;
  try {
    parsed = new URL(reference);
  } catch {
    throw new Error("audio-media-reference-invalid");
  }
  if (
    parsed.protocol !== "media:" ||
    parsed.hostname !== "inbound" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("audio-media-reference-invalid");
  }
  let id: string;
  try {
    id = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("audio-media-reference-invalid");
  }
  if (!id || path.posix.basename(id) !== id || path.win32.basename(id) !== id) {
    throw new Error("audio-media-reference-invalid");
  }
  return id;
}

function songseeArgs(params: Record<string, unknown>): string[] {
  const width = boundedInteger(params.width, 1_280, 256, 2_560, "width");
  const height = boundedInteger(params.height, 720, 256, 2_560, "height");
  if (width * height > 4_194_304) {
    throw new Error("image-pixel-count-too-large");
  }
  const style = optionalString(params, "style", 16) ?? "classic";
  if (!(SONGSEE_STYLES as readonly string[]).includes(style)) {
    throw new Error("style-unsupported");
  }
  const rawVisualizations = params.visualizations ?? ["spectrogram"];
  if (
    !Array.isArray(rawVisualizations) ||
    rawVisualizations.length < 1 ||
    rawVisualizations.length > 9
  ) {
    throw new Error("visualizations-invalid");
  }
  const visualizations = rawVisualizations.map((value) => {
    if (
      typeof value !== "string" ||
      !(SONGSEE_VISUALIZATIONS as readonly string[]).includes(value)
    ) {
      throw new Error("visualization-unsupported");
    }
    return value;
  });
  const start = boundedNumber(params.start, 0, 0, 86_400, "start");
  const duration = boundedNumber(params.duration, 0, 0, 600, "duration");
  const minimumFrequency = boundedNumber(params.minimumFrequency, 0, 0, 96_000, "minimumFrequency");
  const maximumFrequency = boundedNumber(params.maximumFrequency, 0, 0, 96_000, "maximumFrequency");
  if (maximumFrequency > 0 && maximumFrequency <= minimumFrequency) {
    throw new Error("frequency-range-invalid");
  }
  return [
    "-",
    "--output",
    "-",
    "--format",
    "png",
    "--quiet",
    "--width",
    String(width),
    "--height",
    String(height),
    "--style",
    style,
    "--viz",
    visualizations.join(","),
    "--start",
    String(start),
    "--duration",
    String(duration),
    "--min-freq",
    String(minimumFrequency),
    "--max-freq",
    String(maximumFrequency),
  ];
}

function denied(error: unknown) {
  return jsonResult({
    status: "denied",
    reason: error instanceof Error ? error.message : String(error),
  });
}

export function createPhase11CapabilityTools(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
): AnyAgentTool[] {
  return [
    {
      name: "sg_blogwatcher",
      label: "Личные подписки Blogwatcher",
      description:
        "Добавляет и удаляет RSS/Atom-подписки, проверяет новые публикации и отмечает статьи прочитанными. Доступно всем гражданам SG; данные автоматически изолированы по доверенному Global ID текущего отправителя.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["add", "list", "scan", "articles", "read", "read_all", "remove"],
          },
          name: { type: "string", minLength: 1, maxLength: 120 },
          url: { type: "string", minLength: 1, maxLength: 2_048 },
          articleId: { type: "integer", minimum: 1 },
          includeRead: { type: "boolean" },
        },
      },
      async execute(_toolCallId, rawParameters) {
        try {
          const actor = await resolveActor(ctx, stateDir);
          const args = await blogwatcherArgs(asRecord(rawParameters));
          const databasePath = path.join(actor.personalRoot, "blogwatcher", "blogwatcher.db");
          const result = await withNamedLock(blogwatcherLocks, actor.globalId, () =>
            runProcess({
              command: "blogwatcher",
              args,
              env: {
                ...process.env,
                BLOGWATCHER_DB: databasePath,
                NO_COLOR: "1",
                TERM: "dumb",
              },
              timeoutMs: BLOGWATCHER_TIMEOUT_MS,
              maxStdoutBytes: MAX_TEXT_OUTPUT_BYTES,
            }),
          );
          return jsonResult({
            status: "ok",
            action: args[0],
            output: result.stdout.toString("utf8").trim(),
          });
        } catch (error) {
          return denied(error);
        }
      },
    },
    {
      name: "sg_songsee",
      label: "Визуальный анализ аудио Songsee",
      description:
        "Создаёт PNG-спектрограмму или набор аналитических панелей из аудиофайла текущего сообщения. Доступно всем гражданам SG; принимает только защищённую ссылку media://inbound/... и не открывает произвольные пути или URL.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["audio"],
        properties: {
          audio: { type: "string", pattern: "^media://inbound/[^/]+$" },
          visualizations: {
            type: "array",
            minItems: 1,
            maxItems: 9,
            uniqueItems: true,
            items: { type: "string", enum: [...SONGSEE_VISUALIZATIONS] },
          },
          style: { type: "string", enum: [...SONGSEE_STYLES] },
          width: { type: "integer", minimum: 256, maximum: 2_560 },
          height: { type: "integer", minimum: 256, maximum: 2_560 },
          start: { type: "number", minimum: 0, maximum: 86_400 },
          duration: { type: "number", minimum: 0, maximum: 600 },
          minimumFrequency: { type: "number", minimum: 0, maximum: 96_000 },
          maximumFrequency: { type: "number", minimum: 0, maximum: 96_000 },
        },
      },
      async execute(_toolCallId, rawParameters) {
        try {
          await resolveActor(ctx, stateDir);
          const params = asRecord(rawParameters);
          const reference = requiredString(params, "audio", 1_024);
          const { readMediaBuffer } = await import("openclaw/plugin-sdk/media-store");
          const media = await readMediaBuffer(mediaId(reference), "inbound");
          if (media.size > MAX_AUDIO_INPUT_BYTES) {
            throw new Error("audio-too-large");
          }
          const args = songseeArgs(params);
          const result = await withSongseeLock(() =>
            runProcess({
              command: "songsee",
              args,
              input: media.buffer,
              timeoutMs: SONGSEE_TIMEOUT_MS,
              maxStdoutBytes: MAX_IMAGE_OUTPUT_BYTES,
            }),
          );
          if (result.stdout.length === 0) {
            throw new Error("songsee-empty-image");
          }
          return {
            content: [
              {
                type: "text" as const,
                text: "Songsee создал PNG-визуализацию аудио.",
              },
              {
                type: "image" as const,
                data: result.stdout.toString("base64"),
                mimeType: "image/png",
              },
            ],
            details: {
              status: "ok",
              format: "png",
              bytes: result.stdout.length,
            },
          };
        } catch (error) {
          return denied(error);
        }
      },
    },
  ];
}
