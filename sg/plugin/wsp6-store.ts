import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import type { Compilable, Kysely, QueryResult } from "kysely";
import { Kysely as KyselyInstance, SqliteDialect } from "kysely";
import type {
  PluginStateEntry,
  PluginStateKeyedStore,
} from "openclaw/plugin-sdk/plugin-state-runtime";

type Wsp6StateRow = {
  namespace: string;
  key: string;
  value_json: string;
  created_at: number;
};

type Wsp6Database = {
  sg_wsp6_state: Wsp6StateRow;
};

export type Wsp6SqliteStores = {
  definitions: PluginStateKeyedStore<unknown>;
  attempts: PluginStateKeyedStore<unknown>;
};

const compileOnlyDialect = new SqliteDialect({
  database: async () => {
    throw new Error("sg-test-sqlite-async-execution-forbidden");
  },
});

function queryFor(database: DatabaseSync): Kysely<Wsp6Database> {
  void database;
  return new KyselyInstance<Wsp6Database>({ dialect: compileOnlyDialect });
}

function executeQuery<Row>(database: DatabaseSync, query: Compilable<Row>): QueryResult<Row> {
  const compiled = query.compile();
  const statement: StatementSync = database.prepare(compiled.sql);
  const parameters = compiled.parameters as SQLInputValue[];
  if (statement.columns().length > 0) {
    return { rows: [...statement.iterate(...parameters)] as Row[] };
  }
  const result = statement.run(...parameters);
  return { rows: [], numAffectedRows: BigInt(result.changes) };
}

function firstRow<Row>(database: DatabaseSync, query: Compilable<Row>): Row | undefined {
  return executeQuery(database, query).rows[0];
}

function transaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function ensureSchema(database: DatabaseSync): void {
  // This plugin-owned database avoids changing OpenClaw's schema while keeping WSP6 state SQLite-only.
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sg_wsp6_state (
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (namespace, key)
    ) STRICT;
  `);
}

function parseValue<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error("sg-test-state-corrupt");
  }
}

class Wsp6SqliteKeyedStore<T> implements PluginStateKeyedStore<T> {
  private readonly query;

  constructor(
    private readonly database: DatabaseSync,
    private readonly namespace: string,
    private readonly maxEntries: number,
  ) {
    this.query = queryFor(database);
  }

  private row(key: string): Wsp6StateRow | undefined {
    return firstRow(
      this.database,
      this.query
        .selectFrom("sg_wsp6_state")
        .selectAll()
        .where("namespace", "=", this.namespace)
        .where("key", "=", key),
    );
  }

  private count(): number {
    const result = firstRow(
      this.database,
      this.query
        .selectFrom("sg_wsp6_state")
        .select(({ fn }) => fn.count<number>("key").as("count"))
        .where("namespace", "=", this.namespace),
    );
    return Number(result?.count ?? 0);
  }

  private write(key: string, value: T, createdAt = Date.now()): void {
    executeQuery(
      this.database,
      this.query
        .insertInto("sg_wsp6_state")
        .values({
          namespace: this.namespace,
          key,
          value_json: JSON.stringify(value),
          created_at: createdAt,
        })
        .onConflict((conflict) =>
          conflict.columns(["namespace", "key"]).doUpdateSet({
            value_json: JSON.stringify(value),
          }),
        ),
    );
  }

  async register(key: string, value: T): Promise<void> {
    transaction(this.database, () => {
      const current = this.row(key);
      if (!current && this.count() >= this.maxEntries) {
        throw new Error("sg-test-state-capacity-reached");
      }
      this.write(key, value, current?.created_at);
    });
  }

  async registerIfAbsent(key: string, value: T): Promise<boolean> {
    return transaction(this.database, () => {
      if (this.row(key)) {
        return false;
      }
      if (this.count() >= this.maxEntries) {
        throw new Error("sg-test-state-capacity-reached");
      }
      this.write(key, value);
      return true;
    });
  }

  async update(
    key: string,
    updateValue: (current: T | undefined) => T | undefined,
  ): Promise<boolean> {
    return transaction(this.database, () => {
      const current = this.row(key);
      const next = updateValue(current ? parseValue<T>(current.value_json) : undefined);
      if (next === undefined) {
        if (!current) {
          return false;
        }
        executeQuery(
          this.database,
          this.query
            .deleteFrom("sg_wsp6_state")
            .where("namespace", "=", this.namespace)
            .where("key", "=", key),
        );
        return true;
      }
      if (!current && this.count() >= this.maxEntries) {
        throw new Error("sg-test-state-capacity-reached");
      }
      this.write(key, next, current?.created_at);
      return true;
    });
  }

  async lookup(key: string): Promise<T | undefined> {
    const row = this.row(key);
    return row ? parseValue<T>(row.value_json) : undefined;
  }

  async consume(key: string): Promise<T | undefined> {
    return transaction(this.database, () => {
      const row = this.row(key);
      if (!row) {
        return undefined;
      }
      executeQuery(
        this.database,
        this.query
          .deleteFrom("sg_wsp6_state")
          .where("namespace", "=", this.namespace)
          .where("key", "=", key),
      );
      return parseValue<T>(row.value_json);
    });
  }

  async delete(key: string): Promise<boolean> {
    const result = executeQuery(
      this.database,
      this.query
        .deleteFrom("sg_wsp6_state")
        .where("namespace", "=", this.namespace)
        .where("key", "=", key),
    );
    return (result.numAffectedRows ?? 0n) > 0n;
  }

  async entries(): Promise<PluginStateEntry<T>[]> {
    return executeQuery(
      this.database,
      this.query
        .selectFrom("sg_wsp6_state")
        .selectAll()
        .where("namespace", "=", this.namespace)
        .orderBy("created_at", "asc")
        .orderBy("key", "asc"),
    ).rows.map((row) => ({
      key: row.key,
      value: parseValue<T>(row.value_json),
      createdAt: row.created_at,
    }));
  }

  async clear(): Promise<void> {
    executeQuery(
      this.database,
      this.query.deleteFrom("sg_wsp6_state").where("namespace", "=", this.namespace),
    );
  }
}

export function openWsp6SqliteStores(stateDir: string): Wsp6SqliteStores {
  const directory = path.join(stateDir, "sg");
  mkdirSync(directory, { recursive: true });
  const database = new DatabaseSync(path.join(directory, "wsp6.sqlite"));
  ensureSchema(database);
  return {
    definitions: new Wsp6SqliteKeyedStore(database, "definitions", 500),
    attempts: new Wsp6SqliteKeyedStore(database, "attempts", 5_000),
  };
}
