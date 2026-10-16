// Логика подписки на пуши
// Вариант A: по клику — НЕ мгновенный пуш, а отложенный: страница отправляет
// в Service Worker команду «запланируй пуш через N секунд», SW ждёт и показывает
// уведомление по истечении. Так можно проверить доставку, когда вкладка закрыта.

const subscribeBtn = document.getElementById('subscribeBtn');
const statusDiv = document.getElementById('status');

// Задержка пуша после клика (в секундах) — для теста «ушёл со страницы»
const DELAY_SECONDS = 120; // 2 минуты

let swRegistration = null;

function setStatus(msg) { statusDiv.textContent = msg; }

// 1. Регистрация Service Worker (?v=3 заставляет браузер взять свежий sw.js)
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

  // Уже подписан? Показываем кнопку «запланировать пуш»
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
  setStatus('Нажми, чтобы получать уведомления о рефералах');
}

// 2. По клику — если не подписан: подписка; если подписан: планируем отложенный пуш
subscribeBtn.addEventListener('click', async () => {
  if (!swRegistration) return;
  if (Notification.permission === 'denied') return;

  const sub = await swRegistration.pushManager.getSubscription();
  if (sub) {
    scheduleDelayPush();
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
  subscribeBtn.textContent = '✅ Вы подписаны — запланировать пуш';
  subscribeBtn.disabled = false;
  setStatus('Подписка активна. Жми кнопку — пуш придёт через ' + DELAY_SECONDS + ' секунд.');
}

// 3. Отложенный пуш: просим SW поставить таймер и показать уведомление
function scheduleDelayPush() {
  if (!swRegistration || !navigator.serviceWorker.controller) {
    setStatus('❌ Service Worker не активен — невозможно запланировать');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'schedule-push',
    delaySeconds: DELAY_SECONDS,
    title: '🎉 Рефералка',
    body: 'Это отложенный пуш — пришёл, хотя ты уже, возможно, закрыла вкладку!'
  });

  setStatus('⏳ Пуш запланирован через ' + DELAY_SECONDS + ' сек. Закрой вкладку и жди.');
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
