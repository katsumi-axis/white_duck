import { Database } from 'duckdb';
import { config } from '../config/index.js';

let db: Database | null = null;

export function getDatabase(): Database {
  if (!db) {
    // Check both config and direct env var (for tests)
    const mode = config.duckdb.mode || process.env.DUCKDB_MODE || 'file';
    const dbPath = mode === 'memory' ? ':memory:' : config.duckdb.path;
    db = new Database(dbPath);
  }
  return db;
}

// For testing: reset and use in-memory database
export function resetDatabase(useMemory = true): void {
  if (db) {
    db.close();
    db = null;
  }
  if (useMemory) {
    db = new Database(':memory:');
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface QueryResult {
  columns: Array<{ name: string; type: string }>;
  data: Array<unknown[]>;
  rowCount: number;
  executionTime: number;
}

// Convert BigInt to string for JSON serialization
function serializeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = serializeValue(v);
    }
    return obj;
  }
  return value;
}

export function executeQuery(sql: string): Promise<QueryResult> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const database = getDatabase();

    database.all(sql, (err, rows) => {
      if (err) {
        reject(new Error(err.message));
        return;
      }

      const executionTime = (performance.now() - start) / 1000;

      if (!rows || rows.length === 0) {
        resolve({
          columns: [],
          data: [],
          rowCount: 0,
          executionTime,
        });
        return;
      }

      const firstRow = rows[0] as Record<string, unknown>;
      const columns = Object.keys(firstRow).map((name) => ({
        name,
        type: typeof firstRow[name],
      }));

      const data = rows.map((row) => {
        const values = Object.values(row as Record<string, unknown>);
        return values.map(serializeValue);
      });

      resolve({
        columns,
        data,
        rowCount: data.length,
        executionTime,
      });
    });
  });
}

export function getSchemas(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')",
      (err, rows) => {
        if (err) {
          reject(new Error(err.message));
          return;
        }
        const schemas = rows?.map((r) => (r as { schema_name: string }).schema_name) || ['main'];
        resolve(schemas);
      }
    );
  });
}

export interface TableInfo {
  name: string;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount?: number;
}

export function getTables(schema: string): Promise<TableInfo[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = ?
       ORDER BY table_name, ordinal_position`,
      [schema],
      (err, rows) => {
        if (err) {
          reject(new Error(err.message));
          return;
        }

        const tableMap = new Map<string, TableInfo>();

        rows?.forEach((row) => {
          const r = row as {
            table_name: string;
            column_name: string;
            data_type: string;
            is_nullable: string;
          };

          if (!tableMap.has(r.table_name)) {
            tableMap.set(r.table_name, {
              name: r.table_name,
              columns: [],
            });
          }

          tableMap.get(r.table_name)!.columns.push({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === 'YES',
          });
        });

        resolve(Array.from(tableMap.values()));
      }
    );
  });
}
