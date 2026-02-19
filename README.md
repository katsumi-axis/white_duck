# White Duck

A self-hosted DuckDB web interface with a Redash-like UI and HTTP API for external SQL access.

## Features

- **Query Editor**: SQL editor with syntax highlighting (Monaco Editor)
- **Schema Explorer**: Browse databases, schemas, and tables
- **Query Results**: Paginated table view with export options (CSV/JSON)
- **HTTP API**: RESTful API for external applications
- **Remote MCP**: Model Context Protocol endpoint for AI clients (Cursor, etc.)
- **Authentication**: JWT-based web UI auth + API Key for HTTP API
- **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd white_duck

# Copy environment file
cp .env.example .env

# Edit .env to set your secrets
# JWT_SECRET and API_KEY should be changed in production

# Start the server
docker-compose up -d

# Open http://localhost:3000
# Default login: admin / admin123
```

### Development

```bash
# Backend
cd backend
bun install
bun run dev

# Frontend (in another terminal)
cd frontend
bun install
bun run dev

# Open http://localhost:5173
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `DUCKDB_MODE` | `file` or `memory` | `file` |
| `DUCKDB_PATH` | Database file path | `/data/db.duckdb` |
| `AUTH_ENABLED` | Enable authentication | `true` |
| `JWT_SECRET` | Secret for JWT tokens | (required) |
| `API_KEY` | API key for HTTP API | (required) |
| `DEFAULT_USER` | Default username | `admin` |
| `DEFAULT_PASSWORD` | Default password | `admin123` |

### Generating secrets

**JWT_SECRET** — Used to sign and verify JWT tokens (web UI login). Use a long, random secret.

```bash
# Example: 32-byte random value, base64-encoded
openssl rand -base64 32
```

**API_KEY** — Used for API access via the `X-API-Key` header. Use a long, random key.

```bash
# Example: 32-byte random value, hex-encoded
openssl rand -hex 32
```

Set the outputs in `.env` as `JWT_SECRET=...` and `API_KEY=...`. Do not use the example placeholders in production.

## HTTP API

### Authentication

Use the `X-API-Key` header for API access:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/schemas
```

Or use Bearer token (from web UI login):

```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3000/api/schemas
```

### Endpoints

#### Execute Query

```bash
POST /api/query
Content-Type: application/json

{
  "sql": "SELECT * FROM my_table LIMIT 10"
}
```

Response:
```json
{
  "columns": [{"name": "id", "type": "number"}],
  "data": [[1], [2], [3]],
  "rowCount": 3,
  "executionTime": 0.012
}
```

#### Get Schemas

```bash
GET /api/schemas
```

#### Get Tables

```bash
GET /api/tables/:schema
```

#### Saved Queries

```bash
# List all
GET /api/queries

# Create
POST /api/queries
{"name": "My Query", "sql": "SELECT 1", "tags": []}

# Get one
GET /api/queries/:id

# Delete
DELETE /api/queries/:id
```

## Remote MCP

White Duck exposes an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server so AI clients can query DuckDB via tools.

### Endpoint

- **URL**: `http://<host>:<port>/mcp`
- Example (local): `http://localhost:3000/mcp`
- **Authentication**: Same as the HTTP API. Send `X-API-Key: <your API_KEY>` or `Authorization: Bearer <JWT>` in request headers. When `AUTH_ENABLED` is `false`, no auth is required.

### Tools

| Tool | Description |
|------|-------------|
| `execute_sql` | Run a SQL query. Argument: `sql` (string). |
| `list_schemas` | List database schemas (e.g. `main`). |
| `list_tables` | List tables and columns for a schema. Argument: `schema` (string). |

### Adding in Cursor

This repo includes a project-level MCP config at `.cursor/mcp.json` that points to `http://localhost:3000/mcp`. If the backend is running locally, Cursor will use it automatically in this project.

When auth is enabled, the MCP endpoint requires the same credentials as the API. In Cursor, add the API key as a header:
1. Open **Cursor Settings** → **MCP** → your `white-duck` server (or add a new Remote server).
2. Set URL to `http://localhost:3000/mcp` (or your deployed base URL + `/mcp`).
3. Add header: `X-API-Key` = your `API_KEY` from `.env` (or use **Headers** in the MCP config if available).
4. Save and restart Cursor if needed; the `white-duck` tools will appear for the AI to use.

### Notes

- MCP uses Streamable HTTP (GET for SSE, POST for JSON-RPC). When `AUTH_ENABLED` is true, the MCP endpoint requires `X-API-Key` or `Authorization: Bearer <JWT>` like the rest of the API.
- For production, run behind HTTPS and restrict origins/hosts as needed.

## Tech Stack

- **Backend**: Bun + Hono + DuckDB
- **Frontend**: React + Vite + TanStack (Query, Table) + Tailwind CSS
- **Editor**: Monaco Editor

## License

MIT
