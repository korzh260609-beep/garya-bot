import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const HANDOFF_PATH = "pillars/project-memory/SG22_PROJECT_MEMORY_HANDOFFS.json";
const REPOSITORY = "korzh260609-beep/garya-bot";
const BRANCH = "dev/sg2.2-openclaw";

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : undefined;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readInput() {
  let content = "";
  for await (const chunk of process.stdin) {
    content += chunk;
  }
  return JSON.parse(content || "{}");
}

async function manifestState(cwd) {
  try {
    const content = await readFile(path.join(cwd, HANDOFF_PATH), "utf8");
    const parsed = JSON.parse(content);
    const validEnvelope =
      parsed?.schemaVersion === 1 &&
      parsed?.repository?.fullName === REPOSITORY &&
      parsed?.repository?.branch === BRANCH &&
      Array.isArray(parsed?.handoffs);
    const handoffIds = validEnvelope
      ? parsed.handoffs
          .map((handoff) => handoff?.handoffId)
          .filter((value) => typeof value === "string" && value.trim())
      : [];
    return { hash: digest(content), handoffIds, parsed: validEnvelope ? parsed : undefined };
  } catch {
    return { hash: "missing-or-invalid", handoffIds: [], parsed: undefined };
  }
}

async function repositoryFingerprint(cwd) {
  const head = git(cwd, ["rev-parse", "HEAD"]);
  if (head === undefined) {
    return undefined;
  }
  const excludedHandoff = `:(exclude)${HANDOFF_PATH}`;
  const diff = git(cwd, ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ".", excludedHandoff]);
  const statusOutput = git(cwd, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--",
    ".",
    excludedHandoff,
  ]);
  if (diff === undefined || statusOutput === undefined) {
    return undefined;
  }
  const untrackedStats = [];
  for (const entry of statusOutput.split("\0")) {
    if (!entry.startsWith("?? ")) {
      continue;
    }
    const relative = entry.slice(3);
    const details = await stat(path.join(cwd, relative)).catch(() => undefined);
    if (details?.isFile()) {
      untrackedStats.push(`${relative}:${details.size}:${details.mtimeMs}`);
    }
  }
  return digest([head.trim(), diff, statusOutput, ...untrackedStats.toSorted()].join("\0"));
}

function validNewHandoff(manifest, previousIds) {
  if (!manifest || !Array.isArray(manifest.handoffs)) {
    return false;
  }
  const previous = new Set(previousIds);
  return manifest.handoffs.some(
    (handoff) =>
      handoff?.schemaVersion === 1 &&
      typeof handoff?.handoffId === "string" &&
      !previous.has(handoff.handoffId) &&
      handoff?.projectKey === "project-sg" &&
      handoff?.authority?.kind === "canonical-project-artifact" &&
      Array.isArray(handoff?.events) &&
      handoff.events.length > 0,
  );
}

async function statePath(cwd, turnId) {
  const gitDirectory = git(cwd, ["rev-parse", "--git-common-dir"]);
  if (gitDirectory === undefined) {
    return undefined;
  }
  const absoluteGitDirectory = path.resolve(cwd, gitDirectory.trim());
  const directory = path.join(absoluteGitDirectory, "sg-project-memory-hooks");
  await mkdir(directory, { recursive: true });
  return path.join(directory, `${digest(turnId)}.json`);
}

async function snapshot(cwd, turnId) {
  const target = await statePath(cwd, turnId);
  const fingerprint = await repositoryFingerprint(cwd);
  if (!target || !fingerprint) {
    return;
  }
  const manifest = await manifestState(cwd);
  await writeFile(
    target,
    JSON.stringify({ fingerprint, manifestHash: manifest.hash, handoffIds: manifest.handoffIds }),
    { mode: 0o600 },
  );
}

async function stop(cwd, turnId) {
  const target = await statePath(cwd, turnId);
  if (!target) {
    return;
  }
  const baseline = JSON.parse(await readFile(target, "utf8").catch(() => "null"));
  const fingerprint = await repositoryFingerprint(cwd);
  if (!baseline || !fingerprint || baseline.fingerprint === fingerprint) {
    return;
  }
  const manifest = await manifestState(cwd);
  if (
    baseline.manifestHash !== manifest.hash &&
    validNewHandoff(manifest.parsed, baseline.handoffIds ?? [])
  ) {
    return;
  }
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `Проект изменён, но новый проверяемый semantic handoff не добавлен в ${HANDOFF_PATH}. ` +
        "Добавь новую immutable handoff-запись о подтверждённых решениях, состоянии задач, инцидентах и исправлениях в этот же рабочий ход. Не проси пользователя отдельно говорить «запомни».",
    }),
  );
}

const input = await readInput();
const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
const turnId = typeof input.turn_id === "string" ? input.turn_id : "unknown-turn";
if (process.argv[2] === "snapshot") {
  await snapshot(cwd, turnId);
} else if (process.argv[2] === "stop") {
  await stop(cwd, turnId);
}
