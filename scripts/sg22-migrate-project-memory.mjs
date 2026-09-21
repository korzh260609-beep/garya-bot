#!/usr/bin/env node
import { lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceDir = path.resolve(process.env.OPENCLAW_WORKSPACE_DIR || "/data/workspace");
const projectKey = process.env.SG22_NATIVE_PROJECT_KEY?.trim();
const legacyRoot = path.join(workspaceDir, "memory", "projects", "sg");
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
