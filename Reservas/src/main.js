import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Vite!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
`

setupCounter(document.querySelector('#counter'))

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function showPWANotificationWarning() {
  if (!document.getElementById('pwa-notification-warning')) {
    const div = document.createElement('div');
    div.id = 'pwa-notification-warning';
    div.style = 'position:fixed;bottom:0;left:0;right:0;background:#ffcc00;color:#222;padding:16px 8px;text-align:center;z-index:9999;font-size:16px;font-weight:bold;box-shadow:0 -2px 8px rgba(0,0,0,0.15);';
    div.innerHTML = '⚠️ Las notificaciones push pueden no funcionar en la app instalada en la pantalla principal. Usa el navegador para recibir notificaciones.';
    document.body.appendChild(div);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (isInStandaloneMode()) {
    // Si está en modo PWA, verifica permisos de notificaciones
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      showPWANotificationWarning();
    }
  }
});
