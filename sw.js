// Service Worker for Brokoons Dashboard PWA
const CACHE_NAME = 'brokoons-v2.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './brl2.png',
  './icon-192x192.png',
  './icon-512x512.png'
];

// External resources to cache
const externalUrlsToCache = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Poppins:wght@300;400;600&display=swap'
];

// Install event
self.addEventListener('install', event => {
  console.log('✅ Service Worker: Installing Brokoons Dashboard...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Service Worker: Caching core app files');
        // Cache core files
        return Promise.all([
          cache.addAll(urlsToCache),
          // Cache external resources
          ...externalUrlsToCache.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                cache.put(url, response);
              }
            }).catch(err => {
              console.log('Failed to cache external resource:', url, err);
            })
          )
        ]);
      })
      .then(() => {
        console.log('✅ Service Worker: All resources cached');
        return self.skipWaiting();
      })
  );
});

// Fetch event - Smart caching strategy
self.addEventListener('fetch', event => {
  // Skip Firebase and other external API calls
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore') ||
      event.request.url.match(/\/api\//) ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If cached and less than 1 hour old, return it
        if (cachedResponse) {
          const cachedTime = new Date(cachedResponse.headers.get('date')).getTime();
          const now = Date.now();
          
          // If cache is fresh (< 1 hour), use it
          if (now - cachedTime < 3600000) { // 1 hour in milliseconds
            return cachedResponse;
          }
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                // Add date header for cache freshness check
                const headers = new Headers(responseToCache.headers);
                headers.append('sw-cached-date', new Date().toISOString());
                
                const cachedResponse = new Response(responseToCache.body, {
                  status: responseToCache.status,
                  statusText: responseToCache.statusText,
                  headers: headers
                });
                
                cache.put(event.request, cachedResponse);
              });

            return networkResponse;
          })
          .catch(error => {
            // If network fails and we have a cached version, use it
            if (cachedResponse) {
              console.log('Network failed, using cached version');
              return cachedResponse;
            }
            
            // If requesting HTML, return the cached index.html
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // For images, return a placeholder
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1b5e20"/><text x="50" y="50" text-anchor="middle" fill="white" font-size="12">No Image</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            throw error;
          });
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('✅ Service Worker: Activated');
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('🗑️ Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Claim clients immediately
      return self.clients.claim();
    })
  );
});

// Push notification support (optional)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || 'Brokoons Update';
  const options = {
    body: data.body || 'New update from Brokoons Dashboard',
    icon: './icon-192x192.png',
    badge: './icon-192x192.png',
    tag: 'brokoons-notification',
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || './';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync (optional - for offline data sync)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-chat-messages') {
    console.log('Background sync: Chat messages');
    // You can implement offline chat message syncing here
  }
});

// Periodic sync (optional)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-stock') {
    console.log('Periodic sync: Stock data');
    // Sync stock data periodically
  }
});
