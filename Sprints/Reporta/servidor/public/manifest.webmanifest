'use strict';
const estadoSW = document.getElementById('sw-estado');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready)
    .then(() => { estadoSW.textContent = 'Service worker registado e ativo.'; })
    .catch(() => { estadoSW.textContent = 'Não foi possível registar o service worker. Consulta a consola e confirma o uso de localhost ou HTTPS.'; });
} else {
  estadoSW.textContent = 'Este navegador não suporta service workers.';
}
