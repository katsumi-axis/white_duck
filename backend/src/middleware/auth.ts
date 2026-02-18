import { Context, Next } from 'hono';
import { verifyToken, validateApiKey } from '../auth/index.js';
import { config } from '../config/index.js';

export async function authMiddleware(c: Context, next: Next) {
  if (!config.auth.enabled) {
    return next();
  }

  // Check API Key (for API access)
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) {
    if (validateApiKey(apiKey)) {
      return next();
    }
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Check Bearer token (for Web UI)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await verifyToken(token);
    if (user) {
      c.set('user', user);
      return next();
    }
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  return c.json({ error: 'Authentication required' }, 401);
}
