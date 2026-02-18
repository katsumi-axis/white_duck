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
} from '../auth/index.js';
import { config } from '../config/index.js';

export const app = new Hono();

// Initialize
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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

// API Key info
app.get('/api/auth/api-key', authMiddleware, (c) => {
  return c.json({ apiKey: config.auth.apiKey });
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

// File upload
app.post('/api/upload', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const tableName = body['table_name'] as string;
    const format = (body['format'] as string) || 'csv';

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'File is required' }, 400);
    }

    if (!tableName) {
      return c.json({ error: 'Table name is required' }, 400);
    }

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const filePath = `${config.uploads.dir}/${tableName}.${format}`;
    await Bun.write(filePath, arrayBuffer);

    // Import into DuckDB
    let importSql: string;
    switch (format) {
      case 'csv':
        importSql = `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${filePath}')`;
        break;
      case 'json':
        importSql = `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${filePath}')`;
        break;
      case 'parquet':
        importSql = `CREATE TABLE ${tableName} AS SELECT * FROM read_parquet('${filePath}')`;
        break;
      default:
        return c.json({ error: 'Unsupported format' }, 400);
    }

    await executeQuery(importSql);

    return c.json({
      success: true,
      tableName,
      message: `Table ${tableName} created successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
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
  console.log(`Server starting on ${config.host}:${config.port}`);
  console.log(`DuckDB mode: ${config.duckdb.mode}`);
  console.log(`Auth enabled: ${config.auth.enabled}`);

  return Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
  });
}
