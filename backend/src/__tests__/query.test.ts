import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

// Import resetDatabase first
import { executeQuery, getSchemas, getTables, resetDatabase, closeDatabase } from '../db/index.js';

describe('Database Operations', () => {
  beforeAll(async () => {
    // Use in-memory database for tests
    resetDatabase(true);

    // Create test tables
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INTEGER PRIMARY KEY,
        name VARCHAR,
        email VARCHAR
      )
    `);
    await executeQuery(`INSERT INTO test_users VALUES (1, 'Alice', 'alice@test.com')`);
    await executeQuery(`INSERT INTO test_users VALUES (2, 'Bob', 'bob@test.com')`);
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('executeQuery', () => {
    test('should execute SELECT query', async () => {
      const result = await executeQuery('SELECT * FROM test_users');

      expect(result.columns).toHaveLength(3);
      expect(result.data).toHaveLength(2);
      expect(result.rowCount).toBe(2);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should execute query with WHERE clause', async () => {
      const result = await executeQuery("SELECT * FROM test_users WHERE name = 'Alice'");

      expect(result.data).toHaveLength(1);
      expect(result.data[0][1]).toBe('Alice');
    });

    test('should execute aggregation query', async () => {
      const result = await executeQuery('SELECT COUNT(*) as count FROM test_users');

      expect(result.data).toHaveLength(1);
      // COUNT returns BigInt in DuckDB
      expect(Number(result.data[0][0])).toBe(2);
    });

    test('should return empty result for no matches', async () => {
      const result = await executeQuery("SELECT * FROM test_users WHERE name = 'NonExistent'");

      expect(result.data).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    test('should throw error for invalid SQL', async () => {
      expect(async () => {
        await executeQuery('SELECT * FROM nonexistent_table');
      }).toThrow();
    });
  });

  describe('getSchemas', () => {
    test('should return list of schemas', async () => {
      const schemas = await getSchemas();
      expect(schemas).toBeDefined();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);
    });
  });

  describe('getTables', () => {
    test('should return tables in schema', async () => {
      const tables = await getTables('main');

      expect(Array.isArray(tables)).toBe(true);
      const testUsersTable = tables.find((t) => t.name === 'test_users');
      expect(testUsersTable).toBeDefined();
      expect(testUsersTable?.columns).toHaveLength(3);
    });
  });
});
