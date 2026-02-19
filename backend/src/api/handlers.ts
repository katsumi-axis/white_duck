import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { executeQuery, getSchemas, getTables } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  generateToken,
  initializeDefaultUser,
  validateUser,
  validateApiKey,
  type User,
} from '../auth/index.js';
import { config } from '../config/index.js';
import { createMcpServer } from '../mcp/index.js';

type Env = { Variables: { user: User } };
export const app = new Hono<Env>();

// CORS configuration: restrict origin in production
const getCorsOrigin = () => {
  if (config.env === 'production') {
    if (!config.corsOrigin) {
      throw new Error('CORS_ORIGIN environment variable is required in production');
    }
    return config.corsOrigin;
  }
  // Development: allow common local origins and null (for desktop apps like Cursor)
  return (origin: string | null) => {
    if (!origin) return true; // Allow null origin (desktop apps)
    const allowed = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
    return allowed.includes(origin);
  };
};

// Initialize
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: getCorsOrigin(),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
  })
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth routes (no auth required)
app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    const user = await validateUser(username, password);
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await generateToken(user);
    return c.json({ token, user });
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500);
  }
});

app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ user });
});

// API Key info - returns only whether an API key is configured (not the actual key)
app.get('/api/auth/api-key', authMiddleware, (c) => {
  return c.json({ hasApiKey: !!config.auth.apiKey });
});

// Query execution
app.post('/api/query', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { sql, format = 'json' } = body;

    if (!sql) {
      return c.json({ error: 'SQL query is required' }, 400);
    }

    const result = await executeQuery(sql);

    if (format === 'csv') {
      const csvHeader = result.columns.map((c) => c.name).join(',');
      const csvRows = result.data.map((row) => row.join(',')).join('\n');
      const csv = `${csvHeader}\n${csvRows}`;
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="query_result.csv"',
        },
      });
    }

    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    return c.json({ error: message }, 400);
  }
});

// Schema routes
app.get('/api/schemas', authMiddleware, async (c) => {
  try {
    const schemas = await getSchemas();
    return c.json({ schemas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get schemas';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/tables/:schema', authMiddleware, async (c) => {
  try {
    const schema = c.req.param('schema');
    const tables = await getTables(schema);
    return c.json({ tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get tables';
    return c.json({ error: message }, 500);
  }
});

// Saved queries (in-memory for now)
const savedQueries = new Map<string, { id: string; name: string; sql: string; tags: string[] }>();

app.get('/api/queries', authMiddleware, () => {
  return Response.json({ queries: Array.from(savedQueries.values()) });
});

app.post('/api/queries', authMiddleware, async (c) => {
  const body = await c.req.json();
  const { name, sql, tags = [] } = body;

  if (!name || !sql) {
    return c.json({ error: 'Name and SQL are required' }, 400);
  }

  const id = crypto.randomUUID();
  savedQueries.set(id, { id, name, sql, tags });

  return c.json({ success: true, query: { id, name, sql, tags } });
});

app.get('/api/queries/:id', authMiddleware, (c) => {
  const query = savedQueries.get(c.req.param('id'));
  if (!query) {
    return c.json({ error: 'Query not found' }, 404);
  }
  return c.json({ query });
});

app.delete('/api/queries/:id', authMiddleware, (c) => {
  const id = c.req.param('id');
  if (!savedQueries.has(id)) {
    return c.json({ error: 'Query not found' }, 404);
  }
  savedQueries.delete(id);
  return c.json({ success: true });
});

// Initialize and start
export async function startServer() {
  await initializeDefaultUser();

  const mcp = createMcpServer();
  // MCP endpoint: handle both SSE (GET) and JSON-RPC (POST)
  // Note: authMiddleware runs before transport.handleRequest, so auth headers are validated
  app.all('/mcp', authMiddleware, async (c) => {
    try {
      return await mcp.transport.handleRequest(c.req.raw);
    } catch (error) {
      console.error('MCP transport error:', error);
      return c.json({ error: 'MCP transport error' }, 500);
    }
  });
  await mcp.server.connect(mcp.transport);

  console.log(`Server starting on ${config.host}:${config.port}`);
  console.log(`DuckDB mode: ${config.duckdb.mode}`);
  console.log(`Auth enabled: ${config.auth.enabled}`);
  console.log(`MCP (remote): http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/mcp`);

  return Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
  });
}
