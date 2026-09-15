import { randomUUID } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";

type ScopedMemoryEntryStatus = "active" | "superseded" | "forgotten";

type ScopedMemoryEntryMetadata = {
  schemaVersion: 1;
  id: string;
  status: ScopedMemoryEntryStatus;
  recordedAt: string;
  supersedesId?: string;
  supersededBy?: string;
};

const ENTRY_PREFIX = "<!-- sg-scoped-memory:";
const ENTRY_SUFFIX = " -->";
const fileMutations = new Map<string, Promise<unknown>>();

async function withFileMutation<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = fileMutations.get(filePath) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  fileMutations.set(filePath, current);
  try {
    return await current;
  } finally {
    if (fileMutations.get(filePath) === current) {
      fileMutations.delete(filePath);
    }
  }
}

function parseEntryLine(
  line: string,
): { metadata: ScopedMemoryEntryMetadata; text: string } | null {
  if (!line.startsWith(ENTRY_PREFIX)) {
    return null;
  }
  const suffixIndex = line.indexOf(ENTRY_SUFFIX, ENTRY_PREFIX.length);
  if (suffixIndex < 0) {
    return null;
  }
  try {
    const value = JSON.parse(
      line.slice(ENTRY_PREFIX.length, suffixIndex),
    ) as Partial<ScopedMemoryEntryMetadata>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.id !== "string" ||
      (value.status !== "active" &&
        value.status !== "superseded" &&
        value.status !== "forgotten") ||
      typeof value.recordedAt !== "string"
    ) {
      return null;
    }
    return {
      metadata: value as ScopedMemoryEntryMetadata,
      text: line.slice(suffixIndex + ENTRY_SUFFIX.length).trimStart(),
    };
  } catch {
    return null;
  }
}

function renderEntry(metadata: ScopedMemoryEntryMetadata, text = ""): string {
  return `${ENTRY_PREFIX}${JSON.stringify(metadata)}${ENTRY_SUFFIX}${text ? ` ${text}` : ""}`;
}

function activeMetadata(id: string, supersedesId?: string): ScopedMemoryEntryMetadata {
  return {
    schemaVersion: 1,
    id,
    status: "active",
    recordedAt: new Date().toISOString(),
    ...(supersedesId ? { supersedesId } : {}),
  };
}

export async function appendScopedMemoryEntry(params: {
  filePath: string;
  idPrefix: "mem" | "rmem";
  text: string;
}): Promise<string> {
  const entryId = `${params.idPrefix}-${Date.now()}-${randomUUID()}`;
  await withFileMutation(params.filePath, async () => {
    await appendFile(params.filePath, `${renderEntry(activeMetadata(entryId), params.text)}\n`, {
      encoding: "utf8",
      flag: "a",
      mode: 0o600,
    });
  });
  return entryId;
}

export async function correctScopedMemoryEntry(params: {
  filePath: string;
  entryId: string;
  idPrefix: "mem" | "rmem";
  text: string;
}): Promise<{ entryId: string; supersedesId: string }> {
  return await withFileMutation(params.filePath, async () => {
    const content = await readFile(params.filePath, "utf8").catch(() => "");
    const lines = content.split(/\r?\n/u);
    const index = lines.findIndex((line) => parseEntryLine(line)?.metadata.id === params.entryId);
    const previous = index >= 0 ? parseEntryLine(lines[index] ?? "") : null;
    if (!previous) {
      throw new Error("sg-memory-entry-not-found");
    }
    if (previous.metadata.status !== "active") {
      throw new Error("sg-memory-entry-not-active");
    }
    const entryId = `${params.idPrefix}-${Date.now()}-${randomUUID()}`;
    lines[index] = renderEntry({
      ...previous.metadata,
      status: "superseded",
      supersededBy: entryId,
    });
    while (lines.at(-1) === "") {
      lines.pop();
    }
    lines.push(renderEntry(activeMetadata(entryId, params.entryId), params.text), "");
    await writeFile(params.filePath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
    return { entryId, supersedesId: params.entryId };
  });
}

export async function forgetScopedMemoryEntry(params: {
  filePath: string;
  entryId: string;
}): Promise<void> {
  await withFileMutation(params.filePath, async () => {
    const content = await readFile(params.filePath, "utf8").catch(() => "");
    const lines = content.split(/\r?\n/u);
    const index = lines.findIndex((line) => parseEntryLine(line)?.metadata.id === params.entryId);
    const selected = index >= 0 ? parseEntryLine(lines[index] ?? "") : null;
    if (!selected) {
      throw new Error("sg-memory-entry-not-found");
    }
    if (selected.metadata.status !== "active") {
      throw new Error("sg-memory-entry-not-active");
    }
    lines[index] = renderEntry({ ...selected.metadata, status: "forgotten" });
    await writeFile(params.filePath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  });
}

export async function exportScopedMemory(
  filePath: string,
  options: { from?: number; maxChars?: number } = {},
): Promise<{ text: string; truncated: boolean; nextFrom?: number }> {
  const content = await readFile(filePath, "utf8").catch(() => "");
  const visible = content.split(/\r?\n/u).flatMap((line) => {
    const entry = parseEntryLine(line);
    if (!entry) {
      return line ? [line] : [];
    }
    return entry.metadata.status === "active" ? [`- [${entry.metadata.id}] ${entry.text}`] : [];
  });
  const text = visible.length > 0 ? `${visible.join("\n")}\n` : "";
  const from = Math.max(0, Math.floor(options.from ?? 0));
  const maxChars = Math.max(1, Math.min(32_000, Math.floor(options.maxChars ?? 32_000)));
  const excerpt = text.slice(from, from + maxChars);
  const nextFrom = from + excerpt.length;
  const truncated = nextFrom < text.length;
  return { text: excerpt, truncated, ...(truncated ? { nextFrom } : {}) };
}
