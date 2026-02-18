export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',

  // DuckDB
  duckdb: {
    mode: process.env.DUCKDB_MODE || 'file',
    path: process.env.DUCKDB_PATH || '/data/db.duckdb',
  },

  // Authentication
  auth: {
    enabled: process.env.AUTH_ENABLED !== 'false',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    apiKey: process.env.API_KEY || 'dev-api-key-change-in-production',
    tokenExpiry: '24h',
  },

  // Default user
  defaultUser: process.env.DEFAULT_USER || 'admin',
  defaultPassword: process.env.DEFAULT_PASSWORD || 'admin123',

  // Uploads
  uploads: {
    dir: process.env.UPLOAD_DIR || '/data/uploads',
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '100') * 1024 * 1024,
  },
};
