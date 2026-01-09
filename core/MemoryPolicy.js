// core/MemoryPolicy.js
// Defines what parts of snapshot are allowed to be persisted as memory.
// No side effects. No DB access. Policy-only.

export const MemoryPolicy = {
  canPersist(entry) {
    return false;
  },
};

