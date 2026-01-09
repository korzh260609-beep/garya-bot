// core/MemoryPolicy.js
// Defines what parts of snapshot are allowed to be persisted as memory.
// No side effects. No DB access. Policy-only.

export const MemoryPolicy = {
  // Backward compatible alias (old name)
  canPersist(entry) {
    return false;
  },

  // Current API used by RepoIndexSnapshot.js
  isAllowed(entry) {
    return false;
  },
};
