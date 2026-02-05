
const CACHE_NAME = 'mealman-v3-robust';
const URLS_TO_CACHE = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// Install Event: Cache Core Assets & Force Skip Waiting
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force new SW to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate Event: Claim Clients & Cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control of all clients immediately
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch Event: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  // 1. IGNORE Non-HTTP requests (chrome-extension, etc)
  if (!event.request.url.startsWith('http')) return;

  // 2. CRITICAL: IGNORE Supabase API calls completely.
  // Passing these to the browser directly fixes "Failed to fetch" during auth.
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // 3. Handle App Assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone and Cache GET requests
        if (event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
               cache.put(event.request, responseToCache);
            });
        }

        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        // Navigation fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('/');
        }
        
        return new Response(JSON.stringify({ error: 'Offline', message: 'You are offline.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
      })
  );
});
