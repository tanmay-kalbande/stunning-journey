// IMPORTANT: Increment this version number with each deployment
const CACHE_VERSION = 'pustakam-v0.1.3';
const CACHE_NAME = 'pustakam-v0.1.3';
const SW_VERSION = 'pustakam-v0.1.3';
const urlsToCache = [
    '/',
    '/index.html',
    '/pustakam-logo.png',
    '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return Promise.allSettled(
                    urlsToCache.map(url =>
                        cache.add(url).catch(() => Promise.resolve())
                    )
                );
            })
    );
    // Force the waiting service worker to become active immediately
    self.skipWaiting();
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old kitaab caches AND legacy ai-tutor caches
                    if (cacheName !== CACHE_NAME &&
                        (cacheName.startsWith('kitaab-') || cacheName.startsWith('ai-tutor-') || cacheName.startsWith('pustakam-'))) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all pages immediately
    return self.clients.claim();
});

// Fetch event - Network First strategy for JS/CSS, Cache First for static assets
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip external requests and chrome extensions
    if (
        url.origin !== self.location.origin ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('bigmodel.cn') ||
        event.request.url.includes('api.mistral.ai') ||
        event.request.url.includes('api.cohere.com') ||
        event.request.url.includes('chrome-extension')
    ) {
        return;
    }

    // Network First for JS/CSS assets (always get latest)
    if (url.pathname.match(/\.(js|css)$/)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the new version if successful
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Network First for Navigation requests (HTML) to avoid serving stale index.html
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // Cache First for other static assets (images, fonts, etc.)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;

                return fetch(event.request).then(fetchResponse => {
                    if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                        return fetchResponse;
                    }

                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache).catch(() => {
                            // Silently fail cache operations
                        });
                    });

                    return fetchResponse;
                });
            })
            .catch(() => {
                // Fallback to index.html for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Listen for messages from the app (for manual updates)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
