import { describe, expect, it, vi } from 'vitest';
import {
  registerPwaServiceWorker,
  resolvePwaAssetUrl,
  unregisterPwaServiceWorkers,
} from '@/lib/pwa';

describe('pwa helpers', () => {
  it('resolves service-worker assets relative to the configured base path', () => {
    expect(resolvePwaAssetUrl('sw.js', '/')).toBe('/sw.js');
    expect(resolvePwaAssetUrl('/sw.js', '/kanban')).toBe('/kanban/sw.js');
  });

  it('skips registration when PWA support is disabled', async () => {
    const register = vi.fn();

    const result = await registerPwaServiceWorker({
      enabled: false,
      serviceWorker: { register } as unknown as ServiceWorkerContainer,
    });

    expect(result).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('cleans up existing registrations when disabled for desktop', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([
      { scope: 'https://example.test/kanban/', unregister },
      { scope: 'https://example.test/other/', unregister: vi.fn() },
    ]);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const keys = vi.fn().mockResolvedValue(['veritas-kanban-static-v1', 'other-cache']);
    const originalCaches = window.caches;
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys, delete: deleteCache },
    });

    const result = await registerPwaServiceWorker({
      enabled: false,
      unregisterWhenDisabled: true,
      baseUrl: '/kanban/',
      serviceWorker: { register: vi.fn(), getRegistrations } as unknown as ServiceWorkerContainer,
    });

    expect(result).toBeNull();
    expect(getRegistrations).toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('veritas-kanban-static-v1');
    expect(deleteCache).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: originalCaches,
    });
  });

  it('registers the service worker under the app base path', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = { update } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    const result = await registerPwaServiceWorker({
      enabled: true,
      baseUrl: '/kanban/',
      serviceWorker: { register } as unknown as ServiceWorkerContainer,
    });

    expect(result).toBe(registration);
    expect(register).toHaveBeenCalledWith('/kanban/sw.js', { scope: '/kanban/' });
    expect(update).toHaveBeenCalled();
  });

  it('can unregister service workers directly for a base path', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi
      .fn()
      .mockResolvedValue([{ scope: 'https://example.test/kanban/', unregister }]);

    await unregisterPwaServiceWorkers({
      baseUrl: '/kanban/',
      serviceWorker: { getRegistrations } as unknown as ServiceWorkerContainer,
    });

    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
