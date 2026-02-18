import { describe, test, expect, beforeEach, vi } from 'vitest';
import { api } from '../lib/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('get', () => {
    test('should make GET request with auth header', async () => {
      localStorage.setItem('token', 'test-token');
      const mockData = { test: 'data' };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const result = await api.get('/test');

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual(mockData);
    });

    test('should handle 401 and redirect to login', async () => {
      localStorage.setItem('token', 'invalid-token');

      // Mock window.location
      const originalLocation = window.location;
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      } as Response);

      await expect(api.get('/test')).rejects.toThrow();

      expect(localStorage.getItem('token')).toBeNull();

      // Restore
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });
  });

  describe('post', () => {
    test('should make POST request with body', async () => {
      const mockData = { success: true };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const result = await api.post('/test', { name: 'test' });

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'test' }),
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('delete', () => {
    test('should make DELETE request', async () => {
      const mockData = { success: true };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const result = await api.delete('/test/1');

      expect(fetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual(mockData);
    });
  });
});
