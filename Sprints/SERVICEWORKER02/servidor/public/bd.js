// Partilhado por scripts clássicos da página e importScripts do service worker.
const NOME_BD = 'sugestoes-bd';
const VERSAO_BD = 2;
let ligacao = null;
let abertura = null;
let aoMudarVersao = null;
function registarAoMudarVersao(cb) { aoMudarVersao = cb; }
function abrirBD() {
  if (ligacao) return Promise.resolve(ligacao);
  if (abertura) return abertura;
  abertura = new Promise((resolve, reject) => {
    const p = indexedDB.open(NOME_BD, VERSAO_BD);
    p.onupgradeneeded = e => {
      const bd = p.result;
      if (e.oldVersion < 1) {
        const s = bd.createObjectStore('sugestoes', { keyPath: 'id' });
        s.createIndex('porEstado', 'estado'); s.createIndex('porData', 'dataCriacao');
        bd.createObjectStore('pendentes', { keyPath: 'idLocal', autoIncrement: true });
        bd.createObjectStore('meta', { keyPath: 'chave' });
      }
      if (e.oldVersion < 2) {
        const pendentes = p.transaction.objectStore('pendentes');
        if (!pendentes.indexNames.contains('porUtilizador')) pendentes.createIndex('porUtilizador', 'utilizador');
        const cursor = pendentes.openCursor();
        cursor.onsuccess = () => { const c = cursor.result; if (!c) return;
          c.update({ ...c.value, chave: c.value.chave || crypto.randomUUID(), tentativas: c.value.tentativas || 0, ultimaTentativa: c.value.ultimaTentativa || null }); c.continue(); };
      }
    };
    p.onblocked = () => console.warn('Feche ou atualize os outros separadores para migrar a base.');
    p.onerror = () => { abertura = null; reject(p.error); };
    p.onsuccess = () => { ligacao = p.result; abertura = null;
      ligacao.onversionchange = () => { ligacao.close(); ligacao = null; abertura = null; aoMudarVersao?.(); };
      resolve(ligacao);
    };
  });
  return abertura;
}
async function transacaoBD(lojas, modo, executar) {
  const bd = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(lojas, modo); let resultado;
    tx.oncomplete = () => resolve(resultado);
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada.'));
    tx.onerror = () => {};
    try { executar(tx, r => { resultado = r; }); } catch (e) { tx.abort(); reject(e); }
  });
}
function guardarProprietario(dados) {
  return transacaoBD(['meta', 'pendentes', 'sugestoes'], 'readwrite', tx => {
    const meta = tx.objectStore('meta'), p = meta.get('proprietario');
    p.onsuccess = () => {
      if (p.result && p.result.utilizador !== dados.utilizador) {
        meta.clear(); tx.objectStore('pendentes').clear(); tx.objectStore('sugestoes').clear();
      }
      meta.put({ ...dados, chave: 'proprietario' });
    };
  });
}
function lerMetaBD(chave) {
  return transacaoBD(['meta'], 'readonly', (tx, r) => { const p = tx.objectStore('meta').get(chave); p.onsuccess = () => r(p.result ?? null); });
}
function lerProprietario() { return lerMetaBD('proprietario'); }
async function lerCursor(utilizador) { return (await lerMetaBD('cursor:' + utilizador))?.valor ?? 0; }
function limparBD() { return transacaoBD(['meta','pendentes','sugestoes'], 'readwrite', tx => { for (const n of ['meta','pendentes','sugestoes']) tx.objectStore(n).clear(); }); }
function acrescentarPendente(dados, utilizador) {
  return transacaoBD(['pendentes','meta'], 'readwrite', (tx, r) => {
    const dono = tx.objectStore('meta').get('proprietario');
    dono.onsuccess = () => {
      if (dono.result?.utilizador !== utilizador) { tx.abort(); return; }
      const { titulo, descricao, categoria } = dados;
      const p = tx.objectStore('pendentes').add({ titulo, descricao, categoria, utilizador, chave: crypto.randomUUID(), tentativas: 0, ultimaTentativa: null, erro: null, criadaEm: new Date().toISOString() });
      p.onsuccess = () => r(p.result);
    };
  });
}
function lerTodasPendentes(utilizador) {
  return transacaoBD(['pendentes'], 'readonly', (tx, r) => {
    const p = tx.objectStore('pendentes').index('porUtilizador').getAll(utilizador);
    p.onsuccess = () => r(p.result.sort((a,b) => a.idLocal - b.idLocal));
  });
}
async function lerPendentesDe(utilizador) { return (await lerTodasPendentes(utilizador)).filter(p => !p.erro); }
async function contarPendentes(utilizador) { return (await lerTodasPendentes(utilizador)).length; }
function alterarPendenteBD(idLocal, alterar) {
  return transacaoBD(['pendentes'], 'readwrite', tx => { const loja = tx.objectStore('pendentes'), p = loja.get(idLocal); p.onsuccess = () => { if (p.result) loja.put(alterar(p.result)); }; });
}
function registarTentativa(idLocal) { return alterarPendenteBD(idLocal, p => ({ ...p, tentativas: (p.tentativas || 0) + 1, ultimaTentativa: new Date().toISOString() })); }
function marcarErro(idLocal, mensagem) { return alterarPendenteBD(idLocal, p => ({ ...p, erro: mensagem })); }
function confirmarPendente(idLocal, sugestao, utilizador) {
  return transacaoBD(['pendentes','sugestoes','meta'], 'readwrite', tx => {
    const p = tx.objectStore('meta').get('proprietario'); p.onsuccess = () => {
      if (utilizador && p.result?.utilizador !== utilizador) { tx.abort(); return; }
      tx.objectStore('pendentes').delete(idLocal); tx.objectStore('sugestoes').put(sugestao);
    };
  });
}
function aplicarAlteracoes(utilizador, alteracoes, cursor) {
  return transacaoBD(['sugestoes','meta'], 'readwrite', tx => {
    const p = tx.objectStore('meta').get('proprietario'); p.onsuccess = () => {
      if (p.result?.utilizador !== utilizador) { tx.abort(); return; }
      for (const s of alteracoes) tx.objectStore('sugestoes').put(s);
      tx.objectStore('meta').put({ chave: 'cursor:' + utilizador, valor: cursor });
    };
  });
}
function lerTodasSugestoes(utilizador, ordenacao = 'data_desc') {
  return transacaoBD(['sugestoes'], 'readonly', (tx,r) => {
    const indice = tx.objectStore('sugestoes').index(ordenacao === 'estado' ? 'porEstado' : 'porData');
    const p = indice.openCursor(null, ordenacao === 'data_desc' ? 'prev' : 'next'); const itens=[];
    p.onsuccess = () => { const c=p.result; if (!c) { r(itens); return; }
      if (!utilizador || c.value.numeroAluno === utilizador) itens.push(c.value); c.continue(); };
  });
}
