/**
 * Custom Service Worker — Reserti PWA
 * Compiled by vite-plugin-pwa (injectManifest mode).
 * self.__WB_MANIFEST is injected at build time.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const CACHE_VERSION = 'reserti-v1';

// ── Precache ──────────────────────────────────────────────────
const PRECACHE_URLS = (self.__WB_MANIFEST ?? []).map(e =>
  typeof e === 'string' ? e : e.url,
);

self.addEventListener('install', (event: ExtendableEvent) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // addAll silently skips URLs that fail (cross-origin, etc.)
      return Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)));
    }),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

// ── Fetch — NetworkFirst for API, CacheFirst for assets ───────
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin or relative requests
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) return;

  if (url.pathname.includes('/api/')) {
    // Network-first with 5s timeout
    event.respondWith(
      Promise.race([
        fetch(request.clone()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ])
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then(cached => cached ?? Response.error())),
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then(cached =>
        cached ?? fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE_VERSION).then(c => c.put(request, res.clone())).catch(() => {});
          }
          return res;
        }),
      ),
    );
  }
});

// ── Push notification ─────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; url?: string; tag?: string };
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Reserti', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Reserti', {
      body:  data.body ?? '',
      icon:  '/icon-192.svg',
      badge: '/icon-192.svg',
      tag:   data.tag ?? 'reserti',
      data:  { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
    }),
  );
});

// ── Notification click — focus or open tab ────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c =>
          new URL(c.url).pathname === new URL(targetUrl, self.location.origin).pathname,
        );
        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
