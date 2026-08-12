// OneSignal 푸시 수신·클릭 처리를 이 커스텀 SW에 병합
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'oiji-market-v2';
const SHELL_URLS = [
  '/',
  '/jar',
  '/upload',
  '/noti',
  '/me',
];

// Install — 앱 셸 캐시 (한 URL이 실패해도 전체 설치가 막히지 않도록 개별 캐싱)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => {})))
    )
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

// Fetch — API는 네트워크 우선, 페이지(HTML)도 네트워크 우선(새 배포가 바로 보이도록),
// 해시된 정적 자원(JS/CSS)만 캐시 우선
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 외부 API(Apps Script 등)는 서비스워커가 아예 건드리지 않는다.
  // respondWith 로 가로채면 302 리다이렉트·CORS 처리가 브라우저 기본 동작과
  // 달라져 404/CORS 오류가 나고 지연만 늘어난다. 그냥 통과시키는 게 가장 빠르고 안전.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 페이지 탐색(HTML)은 항상 네트워크 우선 — 캐시가 낡은 index.html을 붙들고
  // 옛 JS 청크를 참조해 '로딩 중...'에서 멈추는 문제 방지. 오프라인일 때만 캐시 사용
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = (await caches.match(req)) || (await caches.match('/'));
          return (
            cached ||
            new Response('<h1>오프라인</h1><p>네트워크 연결을 확인해주세요.</p>', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // 나머지(해시된 JS/CSS 등)는 캐시 우선
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
