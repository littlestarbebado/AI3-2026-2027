// Daniel — estados, sessão, formulários e apresentação. Sem token em JavaScript.
import * as bd from './bd.js';
import { lerConfiguracoes, guardarConfiguracoes } from './configuracoes.js';
import { enviarPendentes, envioEmCurso } from './pendentes.js';
const el = id => document.getElementById(id);
let estado = 'a-verificar';
let sessao = null;
let geracao = 0;
let temporizador;
let controlador = new AbortController();
let categorias = [];
let configuracoes = lerConfiguracoes();
const avisar = texto => { el('mensagem').textContent = texto; };
const hora = data => data ? new Date(data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—';
function contextoNovo() { geracao++; controlador.abort(); controlador = new AbortController(); clearInterval(temporizador); }
function mudarEstado(novo) {
  estado = novo;
  document.body.dataset.estado = novo;
  el('verificacao').hidden = novo !== 'a-verificar';
  el('entrada').hidden = novo !== 'sem-sessao';
  el('sem-ligacao').hidden = novo !== 'sem-ligacao';
  el('sessao').hidden = novo !== 'com-sessao';
  el('configuracoes').hidden = novo === 'a-verificar';
  el('sair').disabled = novo === 'sem-ligacao';
  el('recarregar').disabled = novo !== 'com-sessao';
  el('motivo-sair').textContent = novo === 'sem-ligacao' ? 'Para terminar sessão é necessário contactar o servidor e apagar o cookie HttpOnly.' : '';
  el('ligacao').textContent = novo === 'sem-ligacao' ? 'Sem ligação confirmada ao servidor.' : novo === 'a-verificar' ? 'A verificar sessão…' : 'Servidor contactado.';
}
function aplicarConfiguracoes() {
  document.documentElement.dataset.tema = configuracoes.tema;
  el('tema').value = configuracoes.tema;
  el('ordenacao').value = configuracoes.ordenacao;
}
function lerRascunho() {
  try { const d = JSON.parse(sessionStorage.getItem('rascunhoSugestao')); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function reporRascunho() {
  const r = lerRascunho();
  for (const campo of ['titulo', 'descricao', 'categoria']) el(campo).value = typeof r[campo] === 'string' ? r[campo] : '';
}
function apagarRascunho() { sessionStorage.removeItem('rascunhoSugestao'); el('nova').reset(); }
function dadosFormulario() { return { titulo: el('titulo').value, descricao: el('descricao').value, categoria: el('categoria').value }; }
function expirar(mensagem = 'A sessão expirou. Entre de novo.') {
  contextoNovo(); sessao = null;
  mudarEstado('sem-sessao');
  el('lista').textContent = ''; el('nome').textContent = '';
  avisar(mensagem); // A BD e o rascunho mantêm-se até logout ou mudança de pessoa.
}
async function pedido(url, opcoes = {}) {
  try { return await fetch(url, { ...opcoes, credentials: 'same-origin', cache: 'no-store', signal: controlador.signal }); }
  catch (e) {
    if (e instanceof TypeError) { mudarEstado('sem-ligacao'); await mostrarCopia(); }
    throw e;
  }
}
function iniciarRelogio() {
  clearInterval(temporizador);
  const atualizar = () => {
    if (!sessao) return;
    const restantes = Math.max(0, Math.ceil((Date.parse(sessao.expiracao) - Date.now()) / 1000));
    el('restante').textContent = restantes;
    if (!restantes) expirar();
  };
  temporizador = setInterval(atualizar, 1000); atualizar();
}
function mostrarIdentidade(dono) {
  el('nome').textContent = dono.nome;
  el('papel').textContent = dono.papel === 'aluno' ? 'Aluno' : 'Serviços';
  el('expiracao').textContent = hora(dono.expiracao);
  el('titulo-sessao').textContent = dono.papel === 'aluno' ? 'As minhas sugestões' : 'Todas as sugestões';
  el('nova-area').hidden = dono.papel !== 'aluno';
  el('criar').textContent = estado === 'sem-ligacao' ? 'Guardar para enviar depois' : 'Enviar sugestão';
  el('campos-nova').disabled = categorias.length === 0;
}
async function renderizar() {
  const atual = geracao;
  const [dono, lista, pendentes] = await Promise.all([bd.lerProprietario(), bd.lerSugestoes(configuracoes.ordenacao), bd.lerPendentes()]);
  if (atual !== geracao || !['com-sessao', 'sem-ligacao'].includes(estado) || !dono || Date.parse(dono.expiracao) <= Date.now()) return;
  if (sessao && dono.utilizador !== sessao.utilizador) return;
  el('lista').textContent = '';
  mostrarIdentidade(dono);
  for (const p of pendentes.filter(p => p.utilizador === dono.utilizador)) {
    const li = document.createElement('li'); li.className = 'pendente';
    const titulo = document.createElement('strong'); titulo.textContent = p.titulo;
    const detalhe = document.createElement('span'); detalhe.textContent = p.erro ? `Erro: ${p.erro}` : 'Por enviar';
    const botao = document.createElement('button'); botao.type = 'button'; botao.textContent = 'Descartar'; botao.disabled = envioEmCurso();
    botao.addEventListener('click', () => bd.descartarPendente(p.idLocal, dono.utilizador).then(renderizar).catch(falha));
    li.append(titulo, detalhe, botao); el('lista').append(li);
  }
  for (const s of lista) {
    const li = document.createElement('li');
    const titulo = document.createElement('strong'); titulo.textContent = s.titulo;
    const detalhe = document.createElement('span'); detalhe.textContent = `${s.categoria} · ${s.estado} · ${hora(s.dataCriacao)}`;
    const descricao = document.createElement('p'); descricao.textContent = s.descricao;
    li.append(titulo, detalhe, descricao); el('lista').append(li);
  }
  if (!lista.length && !pendentes.length) { const li = document.createElement('li'); li.textContent = 'Ainda não há sugestões.'; el('lista').append(li); }
  el('atualizacao').textContent = estado === 'sem-ligacao' ? `Cópia de ${hora(dono.atualizadoEm)} — pode estar desatualizada` : `Atualizado às ${hora(dono.atualizadoEm)}`;
}
async function mostrarCopia() {
  const atual = geracao;
  const dono = await bd.lerProprietario();
  if (atual !== geracao || estado !== 'sem-ligacao') return;
  if (dono && Date.parse(dono.expiracao) > Date.now()) {
    el('sessao').hidden = false;
    mostrarIdentidade(dono); reporRascunho(); await renderizar();
    if (!sessao) { sessao = { utilizador: dono.utilizador, nome: dono.nome, papel: dono.papel, expiracao: dono.expiracao }; iniciarRelogio(); }
  } else { el('sessao').hidden = true; el('lista').textContent = ''; }
}
async function carregarCategorias() {
  try {
    // O SW pode responder da cache pública; não se usa o wrapper dos dados privados.
    const r = await fetch('/v2/categorias');
    if (!r.ok) throw new Error('Não foi possível obter as categorias.');
    categorias = await r.json();
    const escolhida = el('categoria').value;
    el('categoria').textContent = '';
    const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Escolher categoria'; el('categoria').append(vazio);
    for (const c of categorias) { const option = document.createElement('option'); option.value = c.codigo; option.textContent = c.descricao; el('categoria').append(option); }
    el('categoria').value = escolhida || lerRascunho().categoria || '';
  } catch { categorias = []; }
  el('campos-nova').disabled = categorias.length === 0;
  el('categorias-aviso').textContent = categorias.length ? '' : 'Sem categorias na rede ou na cache. Não é possível criar sugestões.';
}
async function carregarLista() {
  const atual = geracao; const pessoa = sessao;
  const r = await pedido('/v2/sugestoes');
  if (atual !== geracao) return;
  if (r.status === 401) { expirar(); return; }
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.mensagem ?? 'Não foi possível obter as sugestões.');
  if (atual !== geracao) return;
  await bd.substituirSugestoes(dados.itens, pessoa.utilizador);
  await renderizar();
}
async function sincronizar() {
  await enviarPendentes({ obterSessao: () => estado === 'com-sessao' ? sessao : null, pedido, aoExpirar: expirar, aoMudar: renderizar });
  await renderizar();
}
async function aceitarSessao(dados, focar = false) {
  contextoNovo();
  const atual = geracao;
  const anterior = await bd.lerProprietario();
  if (atual !== geracao) return;
  if (anterior && anterior.utilizador !== dados.utilizador) apagarRascunho();
  await bd.guardarProprietario(dados); // Apaga dados de outra pessoa na mesma transação.
  if (atual !== geracao) return;
  sessao = dados; mudarEstado('com-sessao'); mostrarIdentidade(dados); reporRascunho(); iniciarRelogio();
  if (focar) el('titulo-sessao').focus();
  await carregarCategorias();
  if (atual !== geracao || estado !== 'com-sessao') return;
  await carregarLista();
  if (atual === geracao && estado === 'com-sessao') await sincronizar();
}
async function verificarSessao() {
  if (envioEmCurso()) return;
  contextoNovo(); const atual = geracao;
  mudarEstado('a-verificar'); avisar('');
  try {
    const r = await pedido('/v2/sessao');
    if (atual !== geracao) return;
    if (r.status === 401) { expirar(); return; }
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.mensagem ?? 'Não foi possível verificar a sessão.');
    if (atual === geracao) await aceitarSessao(dados);
  } catch (e) {
    if (e.name === 'AbortError') return;
    if (!(e instanceof TypeError)) { avisar(e.message); return; }
    await carregarCategorias(); await mostrarCopia();
  }
}
function falha(e) { if (e.name !== 'AbortError') avisar(e instanceof TypeError ? 'Sem ligação ao servidor.' : e.message); }
el('login').addEventListener('submit', async evento => {
  evento.preventDefault(); contextoNovo(); const atual = geracao;
  el('entrar').disabled = true; el('entrar').textContent = 'A entrar…'; avisar('');
  try {
    const r = await pedido('/v2/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utilizador: el('utilizador').value, palavraPasse: el('palavraPasse').value }) });
    const dados = await r.json();
    if (atual !== geracao) return;
    el('palavraPasse').value = '';
    if (!r.ok) { mudarEstado('sem-sessao'); avisar(dados.mensagem ?? 'Não foi possível entrar.'); el('palavraPasse').focus(); return; }
    await aceitarSessao(dados, true);
  } catch (e) { if (e instanceof TypeError) { el('palavraPasse').value = ''; avisar('Sem ligação: não é possível entrar.'); } else falha(e); }
  finally { el('entrar').disabled = false; el('entrar').textContent = 'Entrar'; }
});
el('nova').addEventListener('input', () => { try { sessionStorage.setItem('rascunhoSugestao', JSON.stringify(dadosFormulario())); } catch { avisar('Não foi possível guardar o rascunho neste navegador.'); } });
el('nova').addEventListener('submit', async evento => {
  evento.preventDefault();
  if (!el('nova').reportValidity()) return;
  const atual = geracao; const dono = await bd.lerProprietario(); const dados = dadosFormulario();
  if (atual !== geracao || !dono || dono.papel !== 'aluno' || Date.parse(dono.expiracao) <= Date.now()) { expirar(); return; }
  el('criar').disabled = true; avisar('');
  try {
    if (estado === 'sem-ligacao') {
      await bd.acrescentarPendente(dados, dono.utilizador); apagarRascunho(); avisar('Sugestão guardada: por enviar.'); await renderizar(); return;
    }
    let r;
    try { r = await pedido('/v2/sugestoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }); }
    catch (e) {
      if (!(e instanceof TypeError) || atual !== geracao) throw e;
      await bd.acrescentarPendente(dados, dono.utilizador); apagarRascunho(); avisar('Sugestão guardada: por enviar.'); await renderizar(); return;
    }
    if (atual !== geracao) return;
    if (r.status === 401) { expirar(); return; }
    const resposta = await r.json();
    if (!r.ok) throw new Error(resposta.mensagem ?? 'Não foi possível criar a sugestão.');
    if (atual !== geracao) return;
    await bd.guardarSugestao(resposta, dono.utilizador); apagarRascunho(); avisar('Sugestão criada.'); await renderizar();
  } catch (e) { falha(e); }
  finally { el('criar').disabled = false; }
});
async function confirmarSaida(n) {
  if (!n) return true;
  el('texto-saida').textContent = `Há ${n} sugestões por enviar, que serão apagadas. Terminar sessão?`;
  const dialogo = el('confirmar-saida'); dialogo.returnValue = '';
  return new Promise(resolve => { dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'confirmar'), { once: true }); dialogo.showModal(); });
}
el('sair').addEventListener('click', async () => {
  if (estado !== 'com-sessao') return;
  try {
    const n = (await bd.lerPendentes()).length;
    if (!await confirmarSaida(n)) return;
    contextoNovo();
    const r = await pedido('/v2/sessao', { method: 'DELETE' });
    if (r.status !== 204) throw new Error('Não foi possível terminar a sessão.');
    await bd.limparBD(); apagarRascunho(); sessao = null;
    mudarEstado('sem-sessao'); el('lista').textContent = ''; el('nome').textContent = ''; el('login').reset(); avisar('Sessão terminada.'); el('utilizador').focus();
  } catch (e) { if (estado === 'sem-ligacao' && sessao) iniciarRelogio(); falha(e); }
});
for (const id of ['tema', 'ordenacao']) el(id).addEventListener('change', async () => {
  try { configuracoes = guardarConfiguracoes({ tema: el('tema').value, ordenacao: el('ordenacao').value }); aplicarConfiguracoes(); await renderizar(); } catch (e) { falha(e); }
});
el('tentar').addEventListener('click', () => verificarSessao().catch(falha));
el('recarregar').addEventListener('click', () => carregarLista().catch(falha));
window.addEventListener('online', () => verificarSessao().catch(falha));
window.addEventListener('offline', () => { el('ligacao').textContent = 'O navegador indica ausência de rede. A sessão será confirmada no próximo pedido.'; });
// Mudança de proprietário noutro separador: esconder dados antigos antes de voltar a confirmar a sessão.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !envioEmCurso() && estado !== 'a-verificar') verificarSessao().catch(falha); });
async function registarSW() {
  if (!('serviceWorker' in navigator)) return;
  const registo = await navigator.serviceWorker.register('/sw.js');
  function verificarAtualizacao() { el('atualizar-app').hidden = !registo.waiting; }
  verificarAtualizacao();
  registo.addEventListener('updatefound', () => registo.installing?.addEventListener('statechange', verificarAtualizacao));
  el('atualizar-app').addEventListener('click', () => registo.waiting?.postMessage({ tipo: 'ativar' }));
  let controlado = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (controlado) location.reload(); controlado = true; });
}
aplicarConfiguracoes();
registarSW().catch(() => avisar('A cache offline não está disponível neste navegador.'));
verificarSessao().catch(falha);
