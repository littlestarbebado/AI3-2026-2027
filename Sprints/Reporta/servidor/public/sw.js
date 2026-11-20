'use strict';
// Ciclo de vida provisório: sem cache, fetch, fila ou sincronização.
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
