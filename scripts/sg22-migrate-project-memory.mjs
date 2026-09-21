#!/usr/bin/env node
import { lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceDir = path.resolve(process.env.OPENCLAW_WORKSPACE_DIR || "/data/workspace");
const projectKey = process.env.SG22_NATIVE_PROJECT_KEY?.trim();
const legacyRoot = path.join(workspaceDir, "memory", "projects", "sg");
const bootstrapPath = path.resolve(
  process.env.SG22_PROJECT_MEMORY_BOOTSTRAP_PATH ||
    "/app/sg/workspace/PROJECT_MEMORY_BOOTSTRAP.json",
);
const nativeMemoryPath = path.join(workspaceDir, "MEMORY.md");
const legacyKey = "project-sg";
const projectAnnotationPattern = /<!--\s*project:\s*([^<>]*?)\s*-->/gu;

if (!projectKey || /[\r\n<>;]/u.test(projectKey)) {
  throw new Error("sg-project-memory-migration-project-key-invalid");
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (!inside(legacyRoot, target) || entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(target);
    }
  }
  return files;
}

function migrateAnnotations(source) {
  return source.replace(projectAnnotationPattern, (annotation, keysText) => {
    const keys = keysText
      .split(";")
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) => (key === legacyKey ? projectKey : key));
    const uniqueKeys = [...new Set(keys)];
    return uniqueKeys.length > 0 ? `<!-- project: ${uniqueKeys.join("; ")} -->` : annotation;
  });
}

async function writeAtomically(filePath, content, mode) {
  const temporaryPath = `${filePath}.native-project-${process.pid}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, content, { encoding: "utf8", mode });
  await rename(temporaryPath, filePath);
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new Error(`sg-project-memory-bootstrap-${field}-invalid`);
  }
  return value.trim();
}

function parseBootstrap(source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("sg-project-memory-bootstrap-json-invalid");
  }
  if (
    parsed?.schemaVersion !== 1 ||
    parsed.projectKey !== projectKey ||
    !Array.isArray(parsed.records)
  ) {
    throw new Error("sg-project-memory-bootstrap-schema-invalid");
  }
  const ids = new Set();
  return parsed.records.map((record) => {
    const id = requiredText(record?.id, "id");
    if (/[^a-z0-9._:-]/u.test(id)) {
      throw new Error("sg-project-memory-bootstrap-id-invalid");
    }
    if (ids.has(id)) {
      throw new Error("sg-project-memory-bootstrap-id-duplicate");
    }
    ids.add(id);
    const recordedAt = requiredText(record?.recordedAt, "recorded-at");
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(recordedAt)) {
      throw new Error("sg-project-memory-bootstrap-recorded-at-invalid");
    }
    const title = requiredText(record?.title, "title");
    const summary = requiredText(record?.summary, "summary");
    if (!Array.isArray(record?.evidence) || record.evidence.length === 0) {
      throw new Error("sg-project-memory-bootstrap-evidence-invalid");
    }
    const evidence = record.evidence.map((value) => requiredText(value, "evidence"));
    return { id, recordedAt, title, summary, evidence };
  });
}

function formatBootstrapRecord(record) {
  const evidence = record.evidence.map((value) => `\`${value}\``).join(", ");
  return [
    `<!-- sg-project-bootstrap: ${record.id} -->`,
    `<!-- project: ${projectKey} -->`,
    `## ${record.recordedAt} — ${record.title}`,
    "",
    record.summary,
    "",
    `Evidence: ${evidence}`,
    "",
  ].join("\n");
}

async function loadBootstrapRecords() {
  try {
    return parseBootstrap(await readFile(bootstrapPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readNativeMemory() {
  try {
    const fileStat = await lstat(nativeMemoryPath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new Error("sg-project-memory-bootstrap-target-invalid");
    }
    return {
      content: await readFile(nativeMemoryPath, "utf8"),
      mode: fileStat.mode & 0o777,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { content: "", mode: 0o600 };
    }
    throw error;
  }
}

let scanned = 0;
let migrated = 0;
for (const filePath of await collectMarkdownFiles(legacyRoot)) {
  const fileStat = await lstat(filePath);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    continue;
  }
  scanned += 1;
  const source = await readFile(filePath, "utf8");
  const next = migrateAnnotations(source);
  if (next === source) {
    continue;
  }
  await writeAtomically(filePath, next, fileStat.mode & 0o777);
  migrated += 1;
}

console.log(`SG native project memory migration: scanned=${scanned} migrated=${migrated}`);

const bootstrapRecords = await loadBootstrapRecords();
const nativeMemory = await readNativeMemory();
let nextNativeMemory = nativeMemory.content;
let bootstrapAdded = 0;
for (const record of bootstrapRecords) {
  const marker = `<!-- sg-project-bootstrap: ${record.id} -->`;
  if (nextNativeMemory.includes(marker)) {
    continue;
  }
  const separator =
    nextNativeMemory.length === 0 ? "" : nextNativeMemory.endsWith("\n") ? "\n" : "\n\n";
  nextNativeMemory += `${separator}${formatBootstrapRecord(record)}`;
  bootstrapAdded += 1;
}
if (nextNativeMemory !== nativeMemory.content) {
  await writeAtomically(nativeMemoryPath, nextNativeMemory, nativeMemory.mode);
}
console.log(
  `SG native project memory bootstrap: bootstrap_scanned=${bootstrapRecords.length} bootstrap_added=${bootstrapAdded}`,
);
