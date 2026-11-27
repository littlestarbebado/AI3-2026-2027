// sw.js — Service Worker da aplicação de sugestões (API05 - SERVICEWORKER02)
importScripts('/bd.js', '/sincronizacao.js');

const CACHE_INTERFACE = 'interface-v3';
const CACHE_DADOS_PUBLICOS = 'dados-publicos';
const ETIQUETA_SYNC = 'sincronizar-sugestoes';

const FICHEIROS_INTERFACE = [
  '/',
  '/index.html',
  '/estilos.css',
  '/app.js',
  '/configuracoes.js',
  '/bd.js',
  '/pendentes.js',
  '/sincronizacao.js'
];

// Instalação: pré-carregamento dos ficheiros da interface
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_INTERFACE).then((cache) => cache.addAll(FICHEIROS_INTERFACE))
  );
});

// Ativação: remoção de caches antigas (interface-v1, interface-v2)
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves
          .filter((c) => c !== CACHE_INTERFACE && c !== CACHE_DADOS_PUBLICOS)
          .map((c) => caches.delete(c))
      );
    }).then(() => self.clients.claim())
  );
});

// Intercetação de pedidos HTTP (Estratégias de Cache da API04)
self.addEventListener('fetch', evento => {
  const pedido = evento.request, url = new URL(pedido.url);
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/v2/categorias') {
    const rede = (async () => {
      const resposta = await fetch(pedido);
      if (resposta.ok) await (await caches.open(CACHE_DADOS_PUBLICOS)).put(pedido, resposta.clone());
      return resposta;
    })();
    evento.waitUntil(rede.then(() => undefined).catch(() => undefined));
    evento.respondWith((async () => {
      const copia = await (await caches.open(CACHE_DADOS_PUBLICOS)).match(pedido);
      return copia ?? rede;
    })());
    return;
  }
  if (url.pathname.startsWith('/v2/') || !FICHEIROS_INTERFACE.includes(url.pathname)) return;
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE_INTERFACE), copia = await cache.match(pedido);
    if (copia) return copia;
    const resposta = await fetch(pedido);
    if (resposta.ok) await cache.put(pedido, resposta.clone());
    return resposta;
  })());
});

// Controlo de concorrência: garante que apenas uma sincronização corre em cada momento
let emCurso = null;

function sincronizar() {
  // O mesmo Web Lock também protege mudanças do cookie na página.
  const executar = () => executarSincronizacao();
  emCurso ??= (self.navigator.locks ? self.navigator.locks.request('sugestoes-sessao', executar) : executar()).finally(() => {
    emCurso = null;
  });
  return emCurso;
}

// Comunicação com os separadores abertos
async function avisarPaginas(mensagem) {
  const clientes = await self.clients.matchAll({ type: 'window' });
  for (const cliente of clientes) {
    cliente.postMessage(mensagem);
  }
}

// Evento sync acionado pela Background Sync API (browsers Chromium)
self.addEventListener('sync', (evento) => {
  if (evento.tag !== ETIQUETA_SYNC) return;

  evento.waitUntil(
    sincronizar()
      .then(async (resultado) => {
        await avisarPaginas(resultado);
        // Promessa resolvida: sincronização bem sucedida ou sessão expirada
      })
      .catch(async (erro) => {
        const tipo = erro.tipo || 'erro-local';
        await avisarPaginas({
          tipo,
          porEnviar: erro.porEnviar || 0,
          status: erro.status
        });

        // Rejeita a promessa apenas se for erro de rede ou 5xx para o browser agendar nova tentativa
        if (tipo === 'sem-rede' || tipo === 'erro-servidor') {
          throw erro;
        }
      })
  );
});

// Evento message: suporte para o Plano B (Firefox/Safari) e skipWaiting
self.addEventListener('message', (evento) => {
  const dados = evento.data;
  if (!dados) return;

  if (dados.tipo === 'sincronizar') {
    evento.waitUntil(
      sincronizar()
        .then(async (resultado) => {
          await avisarPaginas(resultado);
        })
        .catch(async (erro) => {
          const tipo = erro.tipo || 'erro-local';
          await avisarPaginas({
            tipo,
            porEnviar: erro.porEnviar || 0,
            status: erro.status
          });
        })
    );
  }

  if (dados.tipo === 'ativar') {
    self.skipWaiting();
  }
});
