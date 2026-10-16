// Логика подписки на пуши (этап 2 — с VAPID-ключом для iOS/Safari)
// v5: applicationServerKey задан — Safari/iOS создаст подписку (раньше падало).

const subscribeBtn = document.getElementById('subscribeBtn');
const statusDiv = document.getElementById('status');

let swRegistration = null;

function setStatus(msg) { statusDiv.textContent = msg; }

// 1. Регистрация Service Worker (?v=2 заставляет браузер взять свежий sw.js)
if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
  setStatus('❌ Этот браузер не поддерживает push-уведомления');
} else {
  navigator.serviceWorker.register('sw.js?v=2')
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

  // Уже подписан? Показываем кнопку «пришли пуш»
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

  // Пользователь сам решает — по клику на кнопку системный запрос
  subscribeBtn.disabled = false;
  subscribeBtn.textContent = '🔔 Разрешить уведомления';
  setStatus('Нажми, чтобы получать уведомления о рефералах');
}

// 2. По клику — сразу системный запрос + подписка (без мягкого окна)
subscribeBtn.addEventListener('click', async () => {
  if (!swRegistration) return;
  if (Notification.permission === 'denied') return;

  // Уже подписан? Тогда кнопка работает как «пришли тестовый пуш»
  const sub = await swRegistration.pushManager.getSubscription();
  if (sub) {
    testPush();
    return;
  }

  setStatus('⏳ Запрашиваем разрешение…');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setStatus('❌ Разрешение не дано — пуши не придут');
    return;
  }

  setStatus('⏳ Создаём подписку…');

  try {
    const newSub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BKjnDZ5rH52ksC6H0uL-hGbwHlJASfRTxQja7mM3vYfpxXuD6V0oRkdfhIveliYi-hB7CsstmuCPSRcv1Z6wopA')
    });
    console.log('✅ Подписка:', newSub.endpoint);
    markSubscribed();
  } catch (err) {
    console.error('❌ Ошибка подписки:', err);
    setStatus('❌ ' + err.message);
  }
});

function markSubscribed() {
  subscribeBtn.textContent = '✅ Вы подписаны — пришли мне пуш!';
  subscribeBtn.disabled = false;
  setStatus('Подписка активна. Жми кнопку ещё раз — придёт тестовый пуш.');
}

// 3. Тестовый пуш из Service Worker
async function testPush() {
  await swRegistration.showNotification('🎉 Рефералка', {
    body: 'Твои 200 ₽ из 4 000 уже в прогрессе!',
    icon: 'ya-icon-192.png',
    badge: 'ya-icon-192.png',
    vibrate: [100, 50, 100]
  });
  setStatus('Уведомление отправлено — проверь системные уведомления');
}

// Преобразование VAPID-ключа (base64url-строка) в Uint8Array.
// Так требует браузер: pushManager.subscribe принимает ключ как Uint8Array.
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
