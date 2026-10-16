// Логика подписки на пуши (этап 1 — механика, без VAPID)

const subscribeBtn = document.getElementById('subscribeBtn');
const statusDiv = document.getElementById('status');
const softPrompt = document.getElementById('softPrompt');
const softPromptAllow = document.getElementById('softPromptAllow');
const softPromptLater = document.getElementById('softPromptLater');

let swRegistration = null;

function setStatus(msg) { statusDiv.textContent = msg; }

// 1. Регистрация Service Worker (как в опыте ЮMoney — проверяем поддержку)
if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
  setStatus('❌ Этот браузер не поддерживает push-уведомления');
} else {
  navigator.serviceWorker.register('sw.js')
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
  // Уже подписан?
  const sub = await swRegistration.pushManager.getSubscription();
  if (sub) {
    markSubscribed();
    return;
  }

  // Уже дал разрешение, но подписки нет?
  const permission = Notification.permission;
  if (permission === 'granted') {
    // Разрешение есть — показываем мягкое окно только для создания подписки
    showSoftPrompt();
    return;
  }

  if (permission === 'denied') {
    subscribeBtn.disabled = false;
    subscribeBtn.textContent = '🔕 Уведомления заблокированы';
    setStatus('Разреши уведомления для сайта в настройках браузера, затем обнови страницу');
    return;
  }

  // Default — не спрашивали. Показываем мягкое окно (нюанс для iOS из опыта ЮMoney)
  subscribeBtn.disabled = false;
  subscribeBtn.textContent = '🔔 Разрешить уведомления';
  setStatus('Нажми, чтобы получать уведомления о рефералах');
  showSoftPrompt();
}

// 2. Мягкое окно — сначала объясняем, потом системный запрос.
// Показываем не сразу, а через 5 секунд — чтобы пользователь успел изучить страницу.
function showSoftPrompt() {
  setTimeout(() => { softPrompt.hidden = false; }, 5000);
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
