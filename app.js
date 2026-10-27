// Логика подписки на пуши — вариант «показ сразу при клике» (без сервера).
// Клик по кнопке:
//   1) подписывает (если ещё нет) через VAPID;
//   2) сразу показывает пуш через Service Worker (showNotification).
//
// Работает везде, где есть HTTPS (в т.ч. GitHub Pages) и НЕ требует сервера.
// Ограничение: уведомление показывается, только пока вкладка/ярлык открыт;
// если закрыть — мгновенный пуш не "догонит". (Отложенный фоновый пуш,
// который приходит при закрытой вкладке, делает сервер — см. Вариант B.)

const subscribeBtn = document.getElementById('subscribeBtn');
const statusLine = document.getElementById('status');

let swRegistration = null;

function setStatus(msg) { statusLine.textContent = msg; }

if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
  setStatus('❌ Этот браузер не поддерживает push-уведомления');
} else {
  navigator.serviceWorker.register('sw.js?v=3')
    .then(reg => {
      console.log('✅ Service Worker зарегистрирован');
      swRegistration = reg;
      initFlow();
    })
    .catch(err => {
      console.error('❌ Ошибка SW:', err);
      setStatus('❌ Service Worker не зарегистрировался: ' + err.message);
    });
}

async function initFlow() {
  if (!swRegistration) return;

  const sub = await swRegistration.pushManager.getSubscription();
  if (sub) {
    markSubscribed();
    return;
  }

  if (Notification.permission === 'denied') {
    subscribeBtn.disabled = false;
    subscribeBtn.textContent = '🔕 Уведомления заблокированы';
    setStatus('Разреши уведомления для сайта в настройках браузера, затем обнови страницу');
    return;
  }

  subscribeBtn.disabled = false;
  subscribeBtn.textContent = '🔔 Разрешить уведомления';
  setStatus('Нажми — и получи пуш «Нашли ответ»');
}

subscribeBtn.addEventListener('click', async () => {
  if (!swRegistration) return;
  if (Notification.permission === 'denied') return;

  let sub = await swRegistration.pushManager.getSubscription();

  if (!sub) {
    setStatus('⏳ Запрашиваем разрешение…');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('❌ Разрешение не дано — пуши не придут');
      return;
    }

    setStatus('⏳ Создаём подписку…');
    try {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BKjnDZ5rH52ksC6H0uL-hGbwHlJASfRTxQja7mM3vYfpxXuD6V0oRkdfhIveliYi-hB7CsstmuCPSRcv1Z6wopA')
      });
      console.log('✅ Подписка:', sub.endpoint);
    } catch (err) {
      console.error('❌ Ошибка подписки:', err);
      setStatus('❌ ' + err.message);
      return;
    }
  }

  markSubscribed();

  // Показать пуш сразу при клике — напрямую через Service Worker
  await showLocalPush();
});

function markSubscribed() {
  subscribeBtn.textContent = '🔔 Получить пуш «Нашли ответ»';
  subscribeBtn.disabled = false;
}

// Показать уведомление прямо из страницы (без сервера и POST-запросов).
async function showLocalPush() {
  try {
    setStatus('⏳ Показываем уведомление…');
    await swRegistration.showNotification('Нашли ответ...', {
      body: 'на Ваш вопрос — уже в Яндекс Поиске',
      icon: 'ya-icon-192.png',
      badge: 'ya-icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: '/' },
      tag: 'referral-push'
    });
    setStatus('✅ Пуш «Нашли ответ...» показан! Нажми ещё раз, чтобы показать снова.');
  } catch (err) {
    console.error('❌ Не удалось показать уведомление:', err);
    setStatus('❌ Не удалось показать уведомление: ' + err.message);
  }
}

// Преобразование VAPID-ключа (base64url-строка) в Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
