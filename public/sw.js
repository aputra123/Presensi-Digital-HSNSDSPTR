// Service Worker with Workbox & Aggressive Caching for SMPN 4 Satu Atap Taliabu Barat PWA
const CACHE_VERSION = 'smpn4-presensi-sw-v5-workbox';
const SHELL_CACHE_NAME = `${CACHE_VERSION}-shell`;
const DATA_CACHE_NAME = `${CACHE_VERSION}-data`;
const IMAGE_CACHE_NAME = `${CACHE_VERSION}-images-logos`;
const FONT_CACHE_NAME = `${CACHE_VERSION}-fonts`;
const CAMERA_CACHE_NAME = `${CACHE_VERSION}-camera-assets`;

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

// Attempt to load Workbox from official Google CDN
let workboxLoaded = false;
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');
  if (typeof workbox !== 'undefined') {
    workboxLoaded = true;
    workbox.setConfig({ debug: false });
    console.log('[SW] Workbox loaded successfully. Enabling aggressive caching policies.');
  }
} catch (e) {
  console.warn('[SW] Workbox CDN unreachable or offline. Using native ServiceWorker caching engine.', e);
}

if (workboxLoaded) {
  // Take control immediately
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  // 1. Aggressive Caching for Google Fonts & Web Fonts (CacheFirst - 1 Year)
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com' ||
      url.pathname.match(/\.(woff|woff2|ttf|otf|eot)$/),
    new workbox.strategies.CacheFirst({
      cacheName: FONT_CACHE_NAME,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        }),
      ],
    })
  );

  // 2. Aggressive Caching for Static Icons, Logos, and Images (CacheFirst - 60 Days)
  workbox.routing.registerRoute(
    ({ request, url }) =>
      request.destination === 'image' ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/) ||
      url.hostname.includes('unsplash.com') ||
      url.hostname.includes('wikimedia.org') ||
      url.hostname.includes('dicebear.com'),
    new workbox.strategies.CacheFirst({
      cacheName: IMAGE_CACHE_NAME,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
        }),
      ],
    })
  );

  // 3. Dynamic Attendance & Data APIs (NetworkFirst with 3s timeout and Cache Fallback)
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname.startsWith('/api/') ||
      url.pathname.includes('attendance') ||
      url.pathname.includes('presensi') ||
      url.searchParams.has('data_sync'),
    new workbox.strategies.NetworkFirst({
      cacheName: DATA_CACHE_NAME,
      networkTimeoutSeconds: 3,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );

  // 4. App Shell, Stylesheets, Scripts, Manifest (StaleWhileRevalidate)
  workbox.routing.registerRoute(
    ({ request, url }) =>
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'document' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('/manifest.json'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: SHELL_CACHE_NAME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 150,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    })
  );
}

// Fallback & Native Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache shell warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  const allowedCaches = [
    SHELL_CACHE_NAME,
    DATA_CACHE_NAME,
    IMAGE_CACHE_NAME,
    FONT_CACHE_NAME,
    CAMERA_CACHE_NAME,
  ];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!allowedCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Native Stale-While-Revalidate Fallback for non-Workbox environments
 */
async function nativeStaleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkFetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        await cache.put(request, networkResponse.clone());
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: 'SW_DATA_REVALIDATED',
            url: request.url,
            cacheName: cacheName,
            timestamp: Date.now(),
          });
        }
      }
      return networkResponse;
    })
    .catch((err) => {
      console.warn('[SW Fallback] Network fetch offline for:', request.url, err);
      return null;
    });

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await networkFetchPromise;
    if (networkResponse) return networkResponse;
  } catch (e) {
    console.warn('[SW Fallback] Fetch error:', e);
  }

  if (request.mode === 'navigate') {
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;
  }

  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'Perangkat sedang offline di area sekolah. Data dikelola via penyimpanan lokal.',
      offline: true,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Native Fetch Event handler (runs if Workbox routing did not catch the request)
self.addEventListener('fetch', (event) => {
  if (workboxLoaded) {
    return; // Workbox handles routes
  }

  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/)
  ) {
    event.respondWith(nativeStaleWhileRevalidate(request, IMAGE_CACHE_NAME));
    return;
  }

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('attendance') ||
    url.pathname.includes('presensi')
  ) {
    event.respondWith(nativeStaleWhileRevalidate(request, DATA_CACHE_NAME));
    return;
  }

  event.respondWith(nativeStaleWhileRevalidate(request, SHELL_CACHE_NAME));
});

// Message Listener for explicit cache synchronization from client app
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  // Save current attendance snapshot to data cache
  if (event.data.type === 'CACHE_ATTENDANCE_SNAPSHOT') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const fakeRequest = new Request('/api/attendance-snapshot.json');
      const responseData = new Response(JSON.stringify(event.data.payload), {
        headers: {
          'Content-Type': 'application/json',
          'X-SW-Cached-At': new Date().toISOString(),
        },
      });
      await cache.put(fakeRequest, responseData);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (err) {
      console.warn('[SW] Failed to cache attendance snapshot:', err);
    }
  }

  // Pre-cache Camera Assets & Image Processing Libraries for offline rapid access
  if (event.data.type === 'CACHE_CAMERA_AND_IMAGE_ASSETS') {
    try {
      const cache = await caches.open(CAMERA_CACHE_NAME);
      const urls = event.data.urls || [];
      await Promise.allSettled(
        urls.map(async (url) => {
          try {
            const res = await fetch(url, { mode: 'cors' });
            if (res && res.status === 200) {
              await cache.put(url, res);
            }
          } catch {
            // Ignore individual cache miss
          }
        })
      );
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false });
      }
    }
  }

  // Get cached attendance snapshot
  if (event.data.type === 'GET_CACHED_ATTENDANCE_SNAPSHOT') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const cached = await cache.match('/api/attendance-snapshot.json');
      if (cached && event.ports && event.ports[0]) {
        const json = await cached.json();
        event.ports[0].postMessage({ success: true, data: json });
      } else if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false });
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: String(err) });
      }
    }
  }

  // Skip Waiting
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Client notifies that network connectivity is restored
  if (event.data.type === 'CLIENT_ONLINE_RECONNECTED') {
    console.log('[SW] Client reconnected to network, broadcasting sync trigger to all tabs');
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'SW_TRIGGER_QUEUE_SYNC',
        timestamp: Date.now(),
        reason: 'network_online_reconnected',
      });
    }
  }

  // Backup offline sync queue in service worker cache
  if (event.data.type === 'CACHE_OFFLINE_SYNC_QUEUE') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const req = new Request('/api/offline-sync-queue-backup.json');
      await cache.put(
        req,
        new Response(JSON.stringify(event.data.payload || []), {
          headers: { 'Content-Type': 'application/json', 'X-SW-Cached': new Date().toISOString() },
        })
      );
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (err) {
      console.warn('[SW] Failed to cache offline queue backup:', err);
    }
  }
});

// Background Sync Event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance-queue' || event.tag === 'sync-presensi-queue') {
    console.log('[SW] Background Sync event triggered with tag:', event.tag);
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_TRIGGER_QUEUE_SYNC',
            tag: event.tag,
            timestamp: Date.now(),
            reason: 'background_sync_api',
          });
        });
      })
    );
  }
});
