
// DESTROYER SERVICE WORKER
// This script exists solely to force-unregister any stale service workers 
// that are causing "Origin Mismatch" or "Invalid State" errors in preview environments.

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Take over immediately
});

self.addEventListener('activate', (event) => {
  // Immediately unregister this SW and any others
  event.waitUntil(
    self.registration.unregister()
      .then(() => {
        console.log('[System] Stale Service Worker successfully annihilated.');
        return self.clients.claim();
      })
      .catch((err) => {
        console.error('[System] Failed to unregister SW:', err);
      })
  );
});
