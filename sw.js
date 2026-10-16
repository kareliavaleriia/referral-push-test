// Service Worker: приём push-уведомлений + отложенный пуш (Вариант A)

// Показ уведомления (общая функция и для реального пуша, и для отложенного)
function showReferralPush(title, body) {
  const options = {
    body: body || 'Новое уведомление',
    icon: 'ya-icon-192.png',
    badge: 'ya-icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: '/' },
    tag: 'referral-push'
  };
  return self.registration.showNotification(title || 'Рефералка', options);
}

// 1. Реальный push от сервера (этап 3, пока не используется)
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(showReferralPush(data.title, data.body));
});

// 2. Сообщение от страницы: запланировать отложенный пуш через N секунд.
//    Таймер живёт в SW — пока браузер не убил SW, уведомление покажется.
self.addEventListener('message', function(event) {
  const msg = event.data || {};

  if (msg.type === 'schedule-push') {
    const delay = Math.max(1, (msg.delaySeconds || 120) * 1000);

    event.waitUntil(
      new Promise(function(resolve) {
        // Клиент может закрыть вкладку — таймер продолжает жить в SW
        setTimeout(function() {
          showReferralPush(msg.title, msg.body)
            .then(resolve)
            .catch(function(err) {
              console.error('Ошибка показа отложенного пуша:', err);
              resolve();
            });
        }, delay);
      })
    );
  }
});

// 3. Клик по уведомлению — открыть (или сфокусировать) сайт
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
