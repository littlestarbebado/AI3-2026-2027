
const CACHE_INTERFACE = 'interface-v1';
const CACHE_PUBLICOS = 'dados-publicos';
const FICHEIROS = ['/', '/index.html', '/estilos.css', '/app.js', '/configuracoes.js', '/bd.js', '/pendentes.js'];
self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(CACHE_INTERFACE).then(cache => cache.addAll(FICHEIROS)));
});
self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (![CACHE_INTERFACE, CACHE_PUBLICOS].includes(nome)) await caches.delete(nome);
    await self.clients.claim();
  })());
});
self.addEventListener('message', evento => {
  if (evento.data?.tipo === 'ativar') self.skipWaiting();
});
self.addEventListener('fetch', evento => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/v2/categorias') {
    
    const rede = (async () => {
      const resposta = await fetch(pedido);
      if (resposta.ok) { const cache = await caches.open(CACHE_PUBLICOS); await cache.put(pedido, resposta.clone()); }
      return resposta;
    })();
    evento.waitUntil(rede.then(() => undefined).catch(() => undefined));
    evento.respondWith((async () => (await caches.open(CACHE_PUBLICOS)).match(pedido).then(copia => copia ?? rede))());
    return;
  }
  if (url.pathname.startsWith('/v2/')) return;
  if (!FICHEIROS.includes(url.pathname)) return;
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE_INTERFACE);
    const copia = await cache.match(pedido);
    if (copia) return copia;
    const resposta = await fetch(pedido);
    if (resposta.ok) await cache.put(pedido, resposta.clone());
    return resposta;
  })());
});