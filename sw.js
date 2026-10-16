// Service Worker: приём push-уведомлений

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Новое уведомление',
    icon: 'ya-icon-192.png',
    badge: 'ya-icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    tag: 'referral-push'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Рефералка', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
