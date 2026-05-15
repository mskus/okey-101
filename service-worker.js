const CACHE_NAME = 'okey101-static-v2'; // Sürüm adı v2 yapıldı, eski v1 cache'leri cihazlardan zorla silinecek
const PRECACHE_URLS = ['./index.html', './style.css', './script.js', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// YENİ: Network First (Önce Ağ) Stratejisi
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // İnternet bağlantısı varsa daima yeni dosyayı çek ve arka planda cache'i güncelle
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => {
                // Sadece cihaz internetsizse (offline) eski cache sürümünü göster
                return caches.match(event.request);
            })
    );
});