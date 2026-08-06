export { createPostgresDatabase } from './database.js';
export { runMigrations } from './migrator.js';
export { createPostgresRepositories } from './repositories.js';
export { createPostgresMemoryProvider } from './postgresMemoryProvider.js';
export { createPostgresObservabilityStore } from './postgresObservabilityStore.js';

import { createPostgresDatabase } from './database.js';
import { runMigrations } from './migrator.js';
import { createPostgresRepositories } from './repositories.js';

export function createPostgresPersistence(config = {}) {
  const database = createPostgresDatabase(config);
  const repositories = createPostgresRepositories(database);
  return Object.freeze({
    database,
    repositories,
    async start() {
      await database.start();
      await runMigrations(database);
    },
    close: () => database.close(),
    health: () => database.health()
  });
}
