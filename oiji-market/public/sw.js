const CACHE_NAME = 'oiji-market-v1';
const SHELL_URLS = [
  '/',
  '/jar',
  '/upload',
  '/noti',
  '/me',
];

// Install — 앱 셸 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate — 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — 매물 API는 네트워크 우선, 나머지는 캐시 우선
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 요청은 네트워크 우선
  if (url.href.includes('script.google.com') || url.href.includes('firestore')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 나머지는 캐시 우선
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
