/**
 * Shared API client for CLI and MCP
 */

import type { Task } from '../types/task.types.js';
import { resolveServerUrl, resolveApiKey } from './config-store.js';

/** Standard API response envelope */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Create an API client instance
 * @param baseUrl - Base URL for the API (default: http://localhost:3001)
 * @returns API client function
 */
export function createApiClient(baseUrl?: string) {
  baseUrl = baseUrl ?? resolveServerUrl();
  return async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const apiKey = resolveApiKey();
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const error = (await res.json().catch(() => ({ error: res.statusText }))) as {
        error?: string;
      };
      throw new Error(error.error || `API error: ${res.status}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const body = await res.json();

    // Unwrap standard API envelope { success, data, meta }
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return (body as ApiEnvelope<T>).data;
    }

    return body as T;
  };
}

/**
 * Default API client — resolves URL from env vars → config file → localhost fallback.
 */
export const API_BASE = resolveServerUrl();
export const api = createApiClient(API_BASE);

/**
 * Find task by ID (supports partial matching on ID suffix)
 * @param id - Full or partial task ID
 * @param apiClient - Optional custom API client (defaults to shared api client)
 * @returns Task if found, null otherwise
 */
export async function findTask(id: string, apiClient = api): Promise<Task | null> {
  const tasks = await apiClient<Task[]>('/api/tasks');
  return tasks.find((t) => t.id === id || t.id.endsWith(id)) || null;
}
