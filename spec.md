# White Duck - DuckDB Web Interface & API Server

## Overview

White Duck is a self-hosted DuckDB interface that provides:
- A Redash-like web UI for query execution and visualization
- External SQL access via HTTP API (like MotherDuck)
- Docker-based deployment

## Goals

1. Provide an intuitive web interface for DuckDB operations
2. Enable external applications to execute SQL queries via HTTP API
3. Support collaborative data analysis with query history and saved queries
4. Ensure easy deployment through Docker

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Container                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Web UI (Frontend)                 │    │
│  │         React + TanStack Query/Table/Router         │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │ HTTP/WebSocket                    │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │                   API Server                         │    │
│  │                  (Go / Bun / Node)                   │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │                     DuckDB                           │    │
│  │              (In-memory / File-based)               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Query Editor
- SQL editor with syntax highlighting (Monaco Editor)
- Auto-completion for DuckDB functions
- Query history
- Keyboard shortcuts (Ctrl+Enter to execute)
- Multiple query tabs

### 2. Results View
- Paginated table view (TanStack Table)
- Column sorting and filtering
- Export to CSV/JSON/Parquet
- Data visualization (charts)

### 3. Schema Explorer
- List databases, schemas, tables, views
- Column information with types
- Sample data preview
- Quick insert table/column names to editor

### 4. Saved Queries
- Save and organize queries
- Tags/categories for organization
- Share queries via URL

### 5. HTTP API
RESTful API for external access:

```
POST /api/query
  Body: { "sql": "SELECT * FROM table" }
  Response: { "columns": [...], "data": [...] }

GET /api/schemas
  Response: { "schemas": [...] }

GET /api/tables/:schema
  Response: { "tables": [...] }

POST /api/upload
  Upload CSV/JSON/Parquet files to create tables
```

### 6. Authentication (Optional)
- API key authentication for HTTP API
- Basic auth or OAuth for Web UI (configurable)

---

## Technical Stack

### Backend
- **Language**: Bun (TypeScript native)
- **DuckDB**: Using duckdb-async or duckdb-node
- **API**: RESTful JSON API
- **Auth**: JWT for Web UI, API Key for HTTP API

### Frontend
- **Framework**: React 18+
- **Routing**: TanStack Router
- **Data Fetching**: TanStack Query
- **Table**: TanStack Table
- **Styling**: Tailwind CSS
- **Editor**: Monaco Editor
- **Charts**: Recharts or Tremor

### Deployment
- **Container**: Docker + docker-compose
- **Single binary option**: For Go backend

---

## Configuration

Environment variables:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# DuckDB
DUCKDB_MODE=file          # file or memory
DUCKDB_PATH=/data/db.duckdb

# Authentication
AUTH_ENABLED=true
JWT_SECRET=your-jwt-secret
API_KEY=your-api-key

# Default user (for first setup)
DEFAULT_USER=admin
DEFAULT_PASSWORD=admin123

# Uploads
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_SIZE=100MB
```

---

## API Specification

### Execute Query
```
POST /api/query
Content-Type: application/json
Authorization: Bearer <api_key>  # if auth enabled

Request:
{
  "sql": "SELECT * FROM users LIMIT 10",
  "format": "json"  // json, csv, parquet
}

Response:
{
  "columns": [
    { "name": "id", "type": "INTEGER" },
    { "name": "name", "type": "VARCHAR" }
  ],
  "data": [
    [1, "Alice"],
    [2, "Bob"]
  ],
  "rowCount": 2,
  "executionTime": 0.012
}
```

### Get Schemas
```
GET /api/schemas

Response:
{
  "schemas": ["main", "information_schema"]
}
```

### Get Tables
```
GET /api/tables/:schema

Response:
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INTEGER", "nullable": false },
        { "name": "name", "type": "VARCHAR", "nullable": true }
      ],
      "rowCount": 1000
    }
  ]
}
```

### Upload Data
```
POST /api/upload
Content-Type: multipart/form-data

Form fields:
- file: <data file>
- table_name: target table name
- format: csv, json, parquet

Response:
{
  "success": true,
  "tableName": "my_data",
  "rowCount": 500
}
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  White Duck                              [Settings] [User]  │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌─────────────────────────────────────────────┤
│ │ Schemas   │ │ Query Editor                    [Run] [Save]│
│ │ ├ main    │ │ ┌─────────────────────────────────────────┐ │
│ │ │ ├ users │ │ │ SELECT * FROM users                     │ │
│ │ │ └orders│ │ │ WHERE created_at > '2024-01-01'         │ │
│ │ └info... │ │ │ LIMIT 100;                              │ │
│ └───────────┘ │ └─────────────────────────────────────────┘ │
│               ├─────────────────────────────────────────────┤
│               │ Results (100 rows, 0.012s)   [CSV] [JSON]   │
│               │ ┌───────┬───────┬─────────────┐             │
│               │ │ id    │ name  │ created_at  │             │
│               │ ├───────┼───────┼─────────────┤             │
│               │ │ 1     │ Alice │ 2024-01-15  │             │
│               │ │ 2     │ Bob   │ 2024-01-16  │             │
│               │ └───────┴───────┴─────────────┘             │
└───────────────┴─────────────────────────────────────────────┘
```

---

## Directory Structure

```
white_duck/
├── spec.md
├── docker-compose.yml
├── Dockerfile
├── README.md
├── backend/
│   ├── main.go (or index.ts)
│   ├── go.mod (or package.json)
│   ├── internal/
│   │   ├── api/
│   │   │   ├── handlers.go
│   │   │   └── routes.go
│   │   ├── duckdb/
│   │   │   └── client.go
│   │   └── config/
│   │       └── config.go
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── routes/
│   │   ├── components/
│   │   │   ├── QueryEditor.tsx
│   │   │   ├── ResultsTable.tsx
│   │   │   └── SchemaExplorer.tsx
│   │   ├── hooks/
│   │   └── lib/
│   └── public/
└── data/
    └── db.duckdb
```

---

## Implementation Phases

### Phase 1: Core Backend
- [x] Setup project structure
- [x] Implement DuckDB connection
- [x] Create query execution API
- [x] Add schema introspection

### Phase 2: Basic Frontend
- [x] Setup React + Vite + TanStack
- [x] Implement query editor
- [x] Display query results
- [x] Add schema explorer

### Phase 3: Enhanced Features
- [x] Query history (in-memory)
- [x] Save/load queries
- [x] File upload
- [x] Export results

### Phase 4: Docker & Deployment
- [x] Create Dockerfile
- [x] docker-compose setup
- [x] Documentation

### Phase 5: Optional Features
- [x] Authentication (JWT + API Key)
- [ ] Charts/visualization
- [ ] Multiple database support
- [ ] Query history persistence

---

## Decisions

1. **Backend Language**: Bun/TypeScript
2. **Database Persistence**: File-based (configurable to in-memory)
3. **Multi-tenancy**: Single user with full auth (JWT + API Key)
4. **Real-time**: Not in Phase 1