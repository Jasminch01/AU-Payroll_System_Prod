const CACHE_NAME = 'au-payroll-cache-v2';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  // Skip waiting immediately so this SW activates without requiring all tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Immediately take control of all open clients
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches from previous versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests and skip API calls, auth requests, and cross-origin requests
  const url = new URL(event.request.url);
  const isApiCall = url.pathname.startsWith('/api/');
  const isNonGet = event.request.method !== 'GET';
  const isCrossOrigin = url.origin !== self.location.origin;

  if (isApiCall || isNonGet || isCrossOrigin) {
    // Pass through directly - never cache these
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from AU Payroll',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'AU Payroll', options)
    );
  } catch (err) {
    console.error('Push event error:', err);
    // Fallback for non-JSON data
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('AU Payroll', {
        body: text,
        icon: '/icons/icon-192x192.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
