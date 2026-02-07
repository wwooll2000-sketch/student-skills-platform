// Service Worker لتفعيل الوضع دون اتصال ودعم PWA
const CACHE_NAME = 'students-skills-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap'
];

// تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('خطأ في تخزين الملفات:', err);
      })
  );
  self.skipWaiting();
});

// تنظيف النسخ المتقادمة من الذاكرة المؤقتة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// التعامل مع الطلبات واستخدام الذاكرة المؤقتة
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إرجاع النسخة المخزنة إن وجدت
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then((response) => {
            // التحقق من صحة الاستجابة
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // تخزين النسخة الجديدة
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // إرجاع نسخة مخزنة عند فشل الاتصال
            return caches.match('/index.html');
          });
      })
  );
});
