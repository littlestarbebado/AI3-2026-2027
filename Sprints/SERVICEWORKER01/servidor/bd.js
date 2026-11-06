const NOME_BD = 'sugestoes-bd';
const VERSAO_BD = 1;
let abertura;

export function abrirBD() {
  if (abertura) return abertura;
  abertura = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BD, VERSAO_BD);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains('sugestoes')) {
        const loja = bd.createObjectStore('sugestoes', { keyPath: 'id' });
        loja.createIndex('porEstado', 'estado');
        loja.createIndex('porData', 'dataCriacao');
      }
      if (!bd.objectStoreNames.contains('pendentes')) bd.createObjectStore('pendentes', { keyPath: 'idLocal', autoIncrement: true });
      if (!bd.objectStoreNames.contains('meta')) bd.createObjectStore('meta', { keyPath: 'chave' });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => { abertura = null; reject(pedido.error); };
    pedido.onblocked = () => { abertura = null; reject(new Error('Feche outras separadores da aplicação para atualizar a base local.')); };
  });
  return abertura;
}

function transacao(lojas, modo, configurar) {
  return abrirBD().then(bd => new Promise((resolve, reject) => {
    const tx = bd.transaction(lojas, modo);
    let resultado;
    try { resultado = configurar(tx); } catch (erro) { tx.abort(); reject(erro); return; }
    tx.oncomplete = () => resolve(resultado);
    tx.onabort = () => reject(tx.error ?? new Error('A transação IndexedDB foi cancelada.'));
    tx.onerror = () => {};
  }));
}

export function substituirSugestoes(lista, utilizador) {
  return transacao(['sugestoes', 'meta'], 'readwrite', tx => {
    const sugestoes = tx.objectStore('sugestoes');
    sugestoes.clear();
    for (const item of lista) sugestoes.put(item);
    tx.objectStore('meta').put({ chave: 'atualizadoEm', valor: new Date().toISOString(), utilizador });
  });
}

export function lerSugestoes(ordenacao = 'recentes') {
  return abrirBD().then(bd => new Promise((resolve, reject) => {
    const tx = bd.transaction('sugestoes', 'readonly');
    const loja = tx.objectStore('sugestoes');
    const indice = ordenacao === 'estado' ? loja.index('porEstado') : loja.index('porData');
    const direcao = ordenacao === 'estado' ? 'next' : 'prev';
    const itens = [];
    const pedido = indice.openCursor(null, direcao);
    pedido.onsuccess = () => { const cursor = pedido.result; if (cursor) { itens.push(cursor.value); cursor.continue(); } };
    tx.oncomplete = () => resolve(itens);
    tx.onabort = () => reject(tx.error ?? new Error('Não foi possível ler as sugestões locais.'));
    tx.onerror = () => {};
  }));
}

export function guardarSugestao(sugestao, utilizador) {
  return transacao(['sugestoes', 'meta'], 'readwrite', tx => {
    tx.objectStore('sugestoes').put(sugestao);
    tx.objectStore('meta').put({ chave: 'atualizadoEm', valor: new Date().toISOString(), utilizador });
  });
}

export function acrescentarPendente(dados, utilizador) {
  return transacao('pendentes', 'readwrite', tx => tx.objectStore('pendentes').add({ ...dados, utilizador, criadaEm: new Date().toISOString(), erro: null }));
}

export function lerPendentes() {
  return abrirBD().then(bd => new Promise((resolve, reject) => {
    const tx = bd.transaction('pendentes', 'readonly');
    const pedido = tx.objectStore('pendentes').getAll();
    tx.oncomplete = () => resolve(pedido.result.sort((a, b) => a.idLocal - b.idLocal));
    tx.onabort = () => reject(tx.error ?? new Error('Não foi possível ler as sugestões por enviar.'));
    tx.onerror = () => {};
  }));
}

export function marcarErro(idLocal, mensagem) {
  return transacao('pendentes', 'readwrite', tx => {
    const loja = tx.objectStore('pendentes');
    const pedido = loja.get(idLocal);
    pedido.onsuccess = () => { if (pedido.result) loja.put({ ...pedido.result, erro: mensagem }); };
  });
}

export function confirmarPendente(idLocal, sugestao) {
  return transacao(['pendentes', 'sugestoes', 'meta'], 'readwrite', tx => {
    tx.objectStore('pendentes').delete(idLocal);
    tx.objectStore('sugestoes').put(sugestao);
    tx.objectStore('meta').put({ chave: 'atualizadoEm', valor: new Date().toISOString() });
  });
}

export function descartarPendente(idLocal, utilizador) {
  return transacao('pendentes', 'readwrite', tx => {
    const loja = tx.objectStore('pendentes');
    const pedido = loja.get(idLocal);
    pedido.onsuccess = () => { if (pedido.result?.utilizador === utilizador) loja.delete(idLocal); };
  });
}

export function lerProprietario() {
  return abrirBD().then(bd => new Promise((resolve, reject) => {
    const tx = bd.transaction('meta', 'readonly');
    const pedido = tx.objectStore('meta').get('proprietario');
    tx.oncomplete = () => resolve(pedido.result?.valor ?? null);
    tx.onabort = () => reject(tx.error ?? new Error('Não foi possível ler o proprietário local.'));
    tx.onerror = () => {};
  }));
}

export function guardarProprietario(sessao) {
  return transacao(['meta', 'sugestoes', 'pendentes'], 'readwrite', tx => {
    const meta = tx.objectStore('meta');
    const atual = meta.get('proprietario');
    atual.onsuccess = () => {
      const anterior = atual.result?.valor;
      if (anterior && anterior.utilizador !== sessao.utilizador) {
        tx.objectStore('sugestoes').clear();
        const pendentes = tx.objectStore('pendentes');
        const cursor = pendentes.openCursor();
        cursor.onsuccess = () => { const c = cursor.result; if (c) { if (c.value.utilizador !== sessao.utilizador) c.delete(); c.continue(); } };
      }
      meta.put({ chave: 'proprietario', valor: sessao });
    };
  });
}

export function limparBD() {
  return transacao(['meta', 'sugestoes', 'pendentes'], 'readwrite', tx => {
    tx.objectStore('meta').clear();
    tx.objectStore('sugestoes').clear();
    tx.objectStore('pendentes').clear();
  });
}
