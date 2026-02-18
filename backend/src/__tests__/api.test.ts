import { describe, test, expect, beforeAll } from 'bun:test';
import { app } from '../api/handlers.js';
import { initializeDefaultUser } from '../auth/index.js';
import { config } from '../config/index.js';
import { resetDatabase, closeDatabase } from '../db/index.js';

describe('API Endpoints', () => {
  let token: string;

  beforeAll(async () => {
    // Use in-memory database for tests
    resetDatabase(true);

    await initializeDefaultUser();

    // Get token for authenticated requests
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    token = (loginData as { token: string }).token;
  });

  describe('Health Check', () => {
    test('GET /health should return ok', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect((data as { status: string }).status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/login should return token for valid credentials', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect((data as { token: string }).token).toBeDefined();
    });

    test('POST /api/auth/login should reject invalid credentials', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
      });

      expect(res.status).toBe(401);
    });

    test('POST /api/auth/login should require username and password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Query Execution', () => {
    test('POST /api/query should execute valid SQL', async () => {
      const res = await app.request('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sql: 'SELECT 1 as test' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect((data as { columns: unknown[] }).columns).toHaveLength(1);
      expect((data as { data: unknown[][] }).data).toHaveLength(1);
    });

    test('POST /api/query should require SQL', async () => {
      const res = await app.request('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('POST /api/query should require authentication', async () => {
      const res = await app.request('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT 1' }),
      });

      expect(res.status).toBe(401);
    });

    test('POST /api/query should accept API key auth', async () => {
      const res = await app.request('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.auth.apiKey,
        },
        body: JSON.stringify({ sql: 'SELECT 1 as test' }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Schema Operations', () => {
    test('GET /api/schemas should return schemas', async () => {
      const res = await app.request('/api/schemas', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray((data as { schemas: unknown[] }).schemas)).toBe(true);
    });

    test('GET /api/tables/:schema should return tables', async () => {
      const res = await app.request('/api/tables/main', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray((data as { tables: unknown[] }).tables)).toBe(true);
    });
  });

  describe('Saved Queries', () => {
    test('should create and retrieve saved query', async () => {
      // Create
      const createRes = await app.request('/api/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test Query', sql: 'SELECT 1', tags: ['test'] }),
      });

      expect(createRes.status).toBe(200);
      const createData = await createRes.json();
      const queryId = (createData as { query: { id: string } }).query.id;

      // Get
      const getRes = await app.request(`/api/queries/${queryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect((getData as { query: { name: string } }).query.name).toBe('Test Query');

      // Delete
      const deleteRes = await app.request(`/api/queries/${queryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(deleteRes.status).toBe(200);
    });
  });
});
