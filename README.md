# White Duck

A self-hosted DuckDB web interface with a Redash-like UI and HTTP API for external SQL access.

## Features

- **Query Editor**: SQL editor with syntax highlighting (Monaco Editor)
- **Schema Explorer**: Browse databases, schemas, and tables
- **Query Results**: Paginated table view with export options (CSV/JSON)
- **HTTP API**: RESTful API for external applications
- **Authentication**: JWT-based web UI auth + API Key for HTTP API
- **File Upload**: Import CSV/JSON/Parquet files as tables
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
| `UPLOAD_DIR` | Directory for uploads | `/data/uploads` |
| `MAX_UPLOAD_SIZE` | Max upload size in MB | `100` |

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

#### Upload Data

```bash
POST /api/upload
Content-Type: multipart/form-data

file: <data file>
table_name: my_table
format: csv  # or json, parquet
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

## Tech Stack

- **Backend**: Bun + Hono + DuckDB
- **Frontend**: React + Vite + TanStack (Query, Table) + Tailwind CSS
- **Editor**: Monaco Editor

## License

MIT
