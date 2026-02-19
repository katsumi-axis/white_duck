/**
 * Remote MCP (Model Context Protocol) server for White Duck.
 * Exposes DuckDB operations as MCP tools so AI clients (e.g. Cursor) can query via MCP.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { executeQuery, getSchemas, getTables } from '../db/index.js';

const SERVER_NAME = 'white-duck';
const SERVER_VERSION = '1.0.0';

export function createMcpServer() {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {},
      instructions:
        'DuckDB SQL interface. Use execute_sql to run queries, list_schemas and list_tables to explore schema.',
    }
  );

  server.registerTool(
    'execute_sql',
    {
      title: 'Execute SQL',
      description: 'Execute a read-only SQL query against the DuckDB database. Prefer SELECT; avoid writes in shared environments.',
      inputSchema: z.object({
        sql: z.string().describe('SQL query to execute (e.g. SELECT * FROM table LIMIT 10)'),
      }),
    },
    async ({ sql }) => {
      try {
        const result = await executeQuery(sql);
        const text = JSON.stringify(
          {
            columns: result.columns,
            data: result.data,
            rowCount: result.rowCount,
            executionTime: result.executionTime,
          },
          null,
          2
        );
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_schemas',
    {
      title: 'List Schemas',
      description: 'List all database schemas (excluding system schemas).',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const schemas = await getSchemas();
        const text = JSON.stringify({ schemas }, null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_tables',
    {
      title: 'List Tables',
      description: 'List tables and their columns for a given schema. Use list_schemas first to get schema names (e.g. "main").',
      inputSchema: z.object({
        schema: z.string().describe('Schema name (e.g. "main")'),
      }),
    },
    async ({ schema }) => {
      try {
        const tables = await getTables(schema);
        const text = JSON.stringify({ tables }, null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: false,
  });

  return { server, transport };
}

export type McpServerHandle = ReturnType<typeof createMcpServer>;
