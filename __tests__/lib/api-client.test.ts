import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, api } from '@/lib/api-client';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock notifications
vi.mock('@/lib/notifications', () => ({
  notifications: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('makes successful GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await apiRequest('/api/test');
    
    expect(result.data).toEqual({ data: 'test' });
    expect(result.error).toBeNull();
    expect(result.status).toBe(200);
  });

  it('makes successful POST request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await api.post('/api/test', { foo: 'bar' });
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
    expect(result.data).toEqual({ success: true });
  });

  it('handles HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    const result = await apiRequest('/api/test', { showError: false });
    
    expect(result.data).toBeNull();
    expect(result.error).toBe('Not found');
  });

  it('retries on server errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      });

    const result = await apiRequest('/api/test', { 
      retry: 1,
      retryDelay: 10,
      showError: false,
    });
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ data: 'success' });
  });

  it('does not retry on client errors (4xx)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    const result = await apiRequest('/api/test', { 
      retry: 2,
      showError: false,
    });
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.error).toBe('Bad request');
  });

  it('uses cache for repeated GET requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cached: true }),
    });

    // First request
    await apiRequest('/api/cached', { useCache: true });
    // Second request should use cache
    const result = await apiRequest('/api/cached', { useCache: true });
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ cached: true });
  });
});

describe('api convenience methods', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
  });

  it('api.get works', async () => {
    await api.get('/test');
    expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'GET' }));
  });

  it('api.post works', async () => {
    await api.post('/test', { data: 1 });
    expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'POST' }));
  });

  it('api.put works', async () => {
    await api.put('/test', { data: 1 });
    expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'PUT' }));
  });

  it('api.delete works', async () => {
    await api.delete('/test');
    expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'DELETE' }));
  });
});
