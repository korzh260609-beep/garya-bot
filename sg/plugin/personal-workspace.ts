import path from "node:path";

function requireSafeGlobalId(globalId: string): string {
  const hasControlCharacter = Array.from(globalId).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });
  if (
    !globalId ||
    globalId !== globalId.trim() ||
    globalId === "." ||
    globalId === ".." ||
    hasControlCharacter ||
    path.posix.basename(globalId) !== globalId ||
    path.win32.basename(globalId) !== globalId
  ) {
    throw new Error("sg-personal-workspace-global-id-invalid");
  }
  return globalId;
}

export function resolvePersonalWorkspaceRoot(stateDir: string, globalId: string): string {
  const usersRoot = path.resolve(stateDir, "sg", "users");
  const workspaceRoot = path.resolve(usersRoot, requireSafeGlobalId(globalId));
  const relative = path.relative(usersRoot, workspaceRoot);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("sg-personal-workspace-path-invalid");
  }
  return workspaceRoot;
}
