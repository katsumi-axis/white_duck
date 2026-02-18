import { describe, test, expect, beforeAll } from 'bun:test';
import {
  initializeDefaultUser,
  validateUser,
  generateToken,
  verifyToken,
  validateApiKey,
} from '../auth/index.js';
import { config } from '../config/index.js';

describe('Authentication', () => {
  beforeAll(async () => {
    await initializeDefaultUser();
  });

  describe('validateUser', () => {
    test('should return user for valid credentials', async () => {
      const user = await validateUser('admin', 'admin123');
      expect(user).not.toBeNull();
      expect(user?.username).toBe('admin');
    });

    test('should return null for invalid username', async () => {
      const user = await validateUser('wronguser', 'admin123');
      expect(user).toBeNull();
    });

    test('should return null for invalid password', async () => {
      const user = await validateUser('admin', 'wrongpassword');
      expect(user).toBeNull();
    });
  });

  describe('Token generation and verification', () => {
    test('should generate and verify valid token', async () => {
      const user = { username: 'testuser' };
      const token = await generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.username).toBe('testuser');
    });

    test('should return null for invalid token', async () => {
      const verified = await verifyToken('invalid-token');
      expect(verified).toBeNull();
    });
  });

  describe('API Key validation', () => {
    test('should validate correct API key', () => {
      const result = validateApiKey(config.auth.apiKey);
      expect(result).toBe(true);
    });

    test('should reject incorrect API key', () => {
      const result = validateApiKey('wrong-key');
      expect(result).toBe(false);
    });
  });
});
