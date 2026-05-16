import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: mockLookup,
}));

import { safeFetch, validateWebhookUrl } from '../utils/url-validation.js';

describe('url validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLookup.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks localhost webhook URLs before fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(validateWebhookUrl('https://localhost/hook').valid).toBe(false);
    await expect(safeFetch('https://127.0.0.1/hook')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks hostnames that resolve to private addresses', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    mockLookup.mockResolvedValue([{ address: '10.0.0.12', family: 4 }]);

    await expect(safeFetch('https://hooks.example.test/hook')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forces manual redirect handling for allowed outbound fetches', async () => {
    const response = { ok: true, status: 200 } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchSpy);
    mockLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);

    await expect(
      safeFetch('https://hooks.example.test/hook', { method: 'POST', redirect: 'follow' })
    ).resolves.toBe(response);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.example.test/hook',
      expect.objectContaining({ method: 'POST', redirect: 'manual' })
    );
  });
});
