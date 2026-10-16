// Логика подписки на пуши (этап 1 — механика, без VAPID)
// v3: таймер отсчитывает 5 секунд с момента, когда страница реально видна;
//     sw регистрируется с версией — чтобы браузер не держал старую копию.

const subscribeBtn = document.getElementById('subscribeBtn');
const statusDiv = document.getElementById('status');
const softPrompt = document.getElementById('softPrompt');
const softPromptAllow = document.getElementById('softPromptAllow');
const softPromptLater = document.getElementById('softPromptLater');

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

  // Уже подписан?
  const sub = await swRegistration.pushManager.getSubscription();
  if (sub) {
    markSubscribed();
    return;
  }

  // Уже дал разрешение, но подписки нет?
  const permission = Notification.permission;
  if (permission === 'granted') {
    showSoftPrompt();
    return;
  }

  if (permission === 'denied') {
    subscribeBtn.disabled = false;
    subscribeBtn.textContent = '🔕 Уведомления заблокированы';
    setStatus('Разреши уведомления для сайта в настройках браузера, затем обнови страницу');
    return;
  }

  // Default — не спрашивали. Показываем мягкое окно через 5 секунд видимости.
  subscribeBtn.disabled = false;
  subscribeBtn.textContent = '🔔 Разрешить уведомления';
  setStatus('Нажми, чтобы получать уведомления о рефералах');
  showSoftPrompt();
}

// 2. Мягкое окно — появляется через 5 секунд ПОСЛЕ того, как страница
//    действительно видна пользователю (не в момент загрузки скрипта).
//    Если вкладка ушла в фон — таймер ждёт, пока пользователь вернётся.
function showSoftPrompt() {
  const show = () => { softPrompt.hidden = false; };

  if (document.visibilityState === 'visible') {
    setTimeout(show, 5000);
  } else {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        setTimeout(show, 5000);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
  }
}

softPromptAllow.addEventListener('click', async () => {
  softPrompt.hidden = true;
  await requestPermissionAndSubscribe();
});

softPromptLater.addEventListener('click', () => {
  softPrompt.hidden = true;
  setStatus('Ок! Вернёшься — снова увидишь предложение');
});

// Основная кнопка тоже открывает мягкое окно
subscribeBtn.addEventListener('click', () => {
  if (Notification.permission === 'denied') return;
  showSoftPrompt();
});

// 3. Системный запрос + подписка
async function requestPermissionAndSubscribe() {
  if (!swRegistration) return;

  setStatus('⏳ Запрашиваем разрешение…');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setStatus('❌ Разрешение не дано — пуши не придут');
    return;
  }

  setStatus('⏳ Создаём подписку…');

  try {
    const sub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true
      // applicationServerKey — появится на этапе 2 вместе с VAPID от бэкенда
    });
    console.log('✅ Подписка:', sub.endpoint);
    markSubscribed();
  } catch (err) {
    console.error('❌ Ошибка подписки:', err);
    setStatus('❌ ' + err.message);
  }
}

function markSubscribed() {
  subscribeBtn.textContent = '✅ Вы подписаны — пришли мне пуш!';
  subscribeBtn.disabled = false;
  subscribeBtn.onclick = testPush;
  setStatus('Подписка активна. Жми кнопку ещё раз — придёт тестовый пуш.');
}

// 4. Тестовый пуш из Service Worker
async function testPush() {
  await swRegistration.showNotification('🎉 Рефералка', {
    body: 'Твои 200 ₽ из 4 000 уже в прогрессе!',
    icon: 'ya-icon-192.png',
    badge: 'ya-icon-192.png',
    vibrate: [100, 50, 100]
  });
  setStatus('Уведомление отправлено — проверь системные уведомления');
}
