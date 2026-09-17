globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.caches.delete('api-cache'));
});
