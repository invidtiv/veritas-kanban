export interface RegisterPwaServiceWorkerOptions {
  enabled?: boolean;
  serviceWorker?: ServiceWorkerContainer;
  baseUrl?: string;
  unregisterWhenDisabled?: boolean;
}

const CACHE_NAME_PREFIX = 'veritas-kanban-';

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === '.') return './';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function resolvePwaAssetUrl(
  path: string,
  baseUrl = import.meta.env.BASE_URL || '/'
): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return `${normalizedBase}${path.replace(/^\//, '')}`;
}

export async function registerPwaServiceWorker(
  options: RegisterPwaServiceWorkerOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;

  const serviceWorker = options.serviceWorker ?? navigator.serviceWorker;
  const enabled =
    options.enabled ?? (import.meta.env.PROD || import.meta.env.VITE_ENABLE_PWA === 'true');

  if (!enabled || !serviceWorker) {
    if (!enabled && options.unregisterWhenDisabled && serviceWorker) {
      await unregisterPwaServiceWorkers({
        serviceWorker,
        baseUrl: options.baseUrl,
      });
    }
    return null;
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? import.meta.env.BASE_URL ?? '/');
  const registration = await serviceWorker.register(resolvePwaAssetUrl('sw.js', baseUrl), {
    scope: baseUrl,
  });

  registration.update().catch((error) => {
    console.warn('[PWA] Service worker update check failed:', error);
  });

  return registration;
}

export async function unregisterPwaServiceWorkers(
  options: Pick<RegisterPwaServiceWorkerOptions, 'serviceWorker' | 'baseUrl'> = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  const serviceWorker = options.serviceWorker ?? navigator.serviceWorker;
  if (!serviceWorker) return;

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? import.meta.env.BASE_URL ?? '/');
  const registrations = await serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => registration.scope.endsWith(baseUrl))
      .map((registration) => registration.unregister())
  );

  const cacheStorage = typeof window.caches !== 'undefined' ? window.caches : null;
  if (cacheStorage) {
    const cacheNames = await cacheStorage.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_NAME_PREFIX))
        .map((cacheName) => cacheStorage.delete(cacheName))
    );
  }
}
