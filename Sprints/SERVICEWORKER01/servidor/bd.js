// Mónica — todas as operações só resolvem depois do commit da transação.
let abertura;
export function abrirBD() {
  if (abertura) return abertura;
  abertura = new Promise((resolve, reject) => {
    const pedido = indexedDB.open('sugestoes-bd', 1);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      const sugestoes = bd.createObjectStore('sugestoes', { keyPath: 'id' });
      sugestoes.createIndex('porEstado', 'estado');
      sugestoes.createIndex('porData', 'dataCriacao');
      bd.createObjectStore('pendentes', { keyPath: 'idLocal', autoIncrement: true });
      bd.createObjectStore('meta', { keyPath: 'chave' });
    };
    pedido.onsuccess = () => {
      const bd = pedido.result;
      bd.onversionchange = () => { bd.close(); abertura = null; };
      resolve(bd);
    };
    pedido.onerror = () => { abertura = null; reject(pedido.error); };
    pedido.onblocked = () => { abertura = null; reject(new Error('Feche os outros separadores para atualizar a base de dados.')); };
  });
  return abertura;
}
async function transacao(lojas, modo, executar) {
  const bd = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(lojas, modo);
    let resultado;
    tx.oncomplete = () => resolve(resultado);
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada.'));
    tx.onerror = () => {}; // onabort dá o resultado final da transação.
    try { executar(tx, valor => { resultado = valor; }); } catch (e) { tx.abort(); reject(e); }
  });
}
function comProprietario(tx, utilizador, executar) {
  const pedido = tx.objectStore('meta').get('proprietario');
  pedido.onsuccess = () => {
    if (!pedido.result || (utilizador && pedido.result.utilizador !== utilizador)) { tx.abort(); return; }
    executar(pedido.result);
  };
}
export function lerProprietario() {
  return transacao(['meta'], 'readonly', (tx, devolver) => {
    const p = tx.objectStore('meta').get('proprietario');
    p.onsuccess = () => devolver(p.result ?? null);
  });
}
export function guardarProprietario(sessao) {
  return transacao(['meta', 'sugestoes', 'pendentes'], 'readwrite', tx => {
    const meta = tx.objectStore('meta');
    const p = meta.get('proprietario');
    p.onsuccess = () => {
      const anterior = p.result;
      if (anterior && anterior.utilizador !== sessao.utilizador) {
        tx.objectStore('sugestoes').clear();
        tx.objectStore('pendentes').clear();
      }
      meta.put({ chave: 'proprietario', utilizador: sessao.utilizador, nome: sessao.nome, papel: sessao.papel, expiracao: sessao.expiracao,
        atualizadoEm: anterior?.utilizador === sessao.utilizador ? anterior.atualizadoEm : null });
    };
  });
}
export function substituirSugestoes(lista, utilizador) {
  return transacao(['sugestoes', 'meta'], 'readwrite', tx => comProprietario(tx, utilizador, dono => {
    const loja = tx.objectStore('sugestoes');
    loja.clear();
    for (const sugestao of lista) loja.put(sugestao);
    tx.objectStore('meta').put({ ...dono, atualizadoEm: new Date().toISOString() });
  }));
}
export function lerSugestoes(ordenacao = 'recentes') {
  return transacao(['sugestoes'], 'readonly', (tx, devolver) => {
    const lista = [];
    const indice = tx.objectStore('sugestoes').index(ordenacao === 'estado' ? 'porEstado' : 'porData');
    const p = indice.openCursor(null, ordenacao === 'estado' ? 'next' : 'prev');
    p.onsuccess = () => { const cursor = p.result; if (cursor) { lista.push(cursor.value); cursor.continue(); } else devolver(lista); };
  });
}
export function acrescentarPendente(dados, utilizador) {
  return transacao(['pendentes', 'meta'], 'readwrite', (tx, devolver) => comProprietario(tx, utilizador, () => {
    const { titulo, descricao, categoria } = dados;
    const p = tx.objectStore('pendentes').add({ utilizador, titulo, descricao, categoria, criadaEm: new Date().toISOString(), erro: null });
    p.onsuccess = () => devolver(p.result);
  }));
}
export function lerPendentes() {
  return transacao(['pendentes'], 'readonly', (tx, devolver) => {
    const p = tx.objectStore('pendentes').getAll();
    p.onsuccess = () => devolver(p.result.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm) || a.idLocal - b.idLocal));
  });
}
export function marcarErro(idLocal, mensagem, utilizador) {
  return transacao(['pendentes', 'meta'], 'readwrite', tx => comProprietario(tx, utilizador, () => {
    const loja = tx.objectStore('pendentes'); const p = loja.get(idLocal);
    p.onsuccess = () => { if (p.result) loja.put({ ...p.result, erro: mensagem }); };
  }));
}
export function confirmarPendente(idLocal, sugestao, utilizador) {
  return transacao(['pendentes', 'sugestoes', 'meta'], 'readwrite', tx => comProprietario(tx, utilizador, dono => {
    tx.objectStore('pendentes').delete(idLocal);
    tx.objectStore('sugestoes').put(sugestao);
    tx.objectStore('meta').put({ ...dono, atualizadoEm: new Date().toISOString() });
  }));
}
export function guardarSugestao(sugestao, utilizador) {
  return transacao(['sugestoes', 'meta'], 'readwrite', tx => comProprietario(tx, utilizador, dono => {
    tx.objectStore('sugestoes').put(sugestao);
    tx.objectStore('meta').put({ ...dono, atualizadoEm: new Date().toISOString() });
  }));
}
export function descartarPendente(idLocal, utilizador) {
  return transacao(['pendentes', 'meta'], 'readwrite', tx => comProprietario(tx, utilizador, () => tx.objectStore('pendentes').delete(idLocal)));
}
export function limparBD() {
  return transacao(['sugestoes', 'pendentes', 'meta'], 'readwrite', tx => {
    for (const nome of ['sugestoes', 'pendentes', 'meta']) tx.objectStore(nome).clear();
  });
}
