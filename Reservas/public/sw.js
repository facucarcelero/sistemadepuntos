// Service Worker para notificaciones en segundo plano - Samsung Galaxy S23
const CACHE_NAME = 'los-nogales-v1';
const urlsToCache = [
  '/',
  '/admin.html',
  '/Logo/Logo-Los-Nogales.png',
  '/Logo/favicon-32x32.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('📱 [SW] Service Worker instalado para notificaciones en segundo plano');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ [SW] Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('📱 [SW] Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ [SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar peticiones para cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Manejar notificaciones push en segundo plano
self.addEventListener('push', event => {
  console.log('📱 [SW] Notificación push recibida en segundo plano');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva notificación de Los Nogales',
      icon: '/Logo/Logo-Los-Nogales.png',
      badge: '/Logo/favicon-32x32.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'los-nogales-notification',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Los Nogales', options)
    );
  }
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('📱 [SW] Notificación clickeada en segundo plano');
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/admin.html')
  );
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('📱 [SW] Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aquí se pueden agregar tareas de sincronización
      console.log('🔄 [SW] Ejecutando sincronización en segundo plano')
    );
  }
});

console.log('📱 [SW] Service Worker cargado para Samsung Galaxy S23'); 