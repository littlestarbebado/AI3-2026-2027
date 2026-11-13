// app.js — Lógica principal da interface (API05 - SERVICEWORKER02)
// Implementa: 4 estados, pedirSync(), plano B, mensagens do SW, contagem de sessão

const ETIQUETA_SYNC = 'sincronizar-sugestoes';

// --- Referências ao DOM ---
const corpo = document.body;
const areaVerificar   = document.getElementById('areaVerificar');
const areaSemSessao   = document.getElementById('areaSemSessao');
const areaComSessao   = document.getElementById('areaComSessao');
const areaSemLigacao  = document.getElementById('areaSemLigacao');
const msgSemLigacao   = document.getElementById('msgSemLigacao');
const indicadorLigacao = document.getElementById('indicadorLigacao');
const zonaNotificacao = document.getElementById('zonaNotificacao');

const formLogin          = document.getElementById('formLogin');
const campoUtilizador    = document.getElementById('campoUtilizador');
const campoPalavraPasse  = document.getElementById('campoPalavraPasse');
const erroLogin          = document.getElementById('erroLogin');
const btnEntrar          = document.getElementById('btnEntrar');

const tituloBoasVindas   = document.getElementById('tituloBoasVindas');
const contadorSessao     = document.getElementById('contadorSessao');
const btnTerminarSessao  = document.getElementById('btnTerminarSessao');
const btnTentarNovamente = document.getElementById('btnTentarNovamente');
const selectOrdenacao    = document.getElementById('selectOrdenacao');
const listaSugestoes     = document.getElementById('listaSugestoes');
const btnSincronizarManual = document.getElementById('btnSincronizarManual');

const formSugestao       = document.getElementById('formSugestao');
const campoTitulo        = document.getElementById('campoTitulo');
const campoCategoria     = document.getElementById('campoCategoria');
const campoDescricao     = document.getElementById('campoDescricao');
const erroSugestao       = document.getElementById('erroSugestao');
const btnSubmeterSugestao = document.getElementById('btnSubmeterSugestao');

const dialogConfirmarLogout = document.getElementById('dialogConfirmarLogout');
const msgConfirmarLogout    = document.getElementById('msgConfirmarLogout');
const btnConfirmarLogout    = document.getElementById('btnConfirmarLogout');
const btnCancelarLogout     = document.getElementById('btnCancelarLogout');

const bannerAtualizacao = document.getElementById('bannerAtualizacao');
const btnAtualizarApp   = document.getElementById('btnAtualizarApp');


let temporizadorSessao  = null;
let sessaoAtiva         = null;    
let swRegistado         = null;    
let swAEsperar          = null;    
let falhasPlanoB        = 0;       
let agendamentoPlanoB   = null;
let usarPlanoB = false;
let geracaoUI = 0;
function comBloqueioSessao(tarefa) {
  return navigator.locks ? navigator.locks.request('sugestoes-sessao', tarefa) : tarefa();
}
registarAoMudarVersao(() => mostrarNotificacao('Há uma versão nova da aplicação. Recarregue a página.', 'aviso'));
function expiracaoMs(valor) { return typeof valor === 'number' ? valor : Date.parse(valor); }
    


function mudarEstado(estado) {
  corpo.dataset.estado = estado;

  areaVerificar.hidden  = estado !== 'a-verificar';
  areaSemSessao.hidden  = estado !== 'sem-sessao';
  areaComSessao.hidden = !(estado === 'com-sessao' || (estado === 'sem-ligacao' && sessaoAtiva && Date.now() < expiracaoMs(sessaoAtiva.expiracao))); 
  areaSemLigacao.hidden = estado !== 'sem-ligacao';

  indicadorLigacao.textContent = {
    'a-verificar':  'A verificar sessão…',
    'sem-sessao':   'Sessão não iniciada',
    'com-sessao':   'Online',
    'sem-ligacao':  'Sem ligação'
  }[estado] || '';

  btnTerminarSessao.disabled = (estado === 'sem-ligacao');
}



async function iniciar() {
  // Aplicar configurações guardadas localmente
  const cfg = lerConfiguracoes();
  selectOrdenacao.value = cfg.ordenacao || 'data_desc';

  // Restaurar rascunho se existir
  const rascunho = lerRascunho();
  if (rascunho) {
    if (rascunho.titulo)    campoTitulo.value    = rascunho.titulo;
    if (rascunho.descricao) campoDescricao.value = rascunho.descricao;
  }

  // Registar service worker
  if ('serviceWorker' in navigator) {
    try {
      swRegistado = await navigator.serviceWorker.register('/sw.js');

      // Escutar mensagens do SW (resultados de sincronização)
      navigator.serviceWorker.addEventListener('message', (evento) => {
        tratarMensagemSW(evento.data);
      });

      // Verificar se há um SW em espera (nova versão)
      swAEsperar = swRegistado.waiting;
      if (swAEsperar) mostrarBannerAtualizacao();

      swRegistado.addEventListener('updatefound', () => {
        const novoSW = swRegistado.installing;
        novoSW.addEventListener('statechange', () => {
          if (novoSW.state === 'installed' && navigator.serviceWorker.controller) {
            swAEsperar = novoSW;
            mostrarBannerAtualizacao();
          }
        });
      });

      let jaControlado = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (jaControlado) window.location.reload();
        jaControlado = true;
      });

    } catch (err) {
      console.error('Erro ao registar Service Worker:', err);
    }
  }

  
  mudarEstado('a-verificar');
  await verificarSessao();
}



async function verificarSessao() {
  return comBloqueioSessao(async () => {
    let resposta;
    try { resposta = await fetch('/v2/sessao', { cache: 'no-store' }); }
    catch (e) {
      const proprietario = await lerProprietario();
      if (proprietario && Date.now() < expiracaoMs(proprietario.expiracao)) {
        sessaoAtiva = proprietario;
        tituloBoasVindas.textContent = `Cópia local de ${proprietario.nome}`;
        mudarEstado('sem-ligacao');
        iniciarContagemRegressiva(expiracaoMs(proprietario.expiracao));
        await carregarCategorias(); await mostrarDadosLocais();
        msgSemLigacao.textContent = 'Cópia local: pode estar desatualizada. O logout exige ligação ao servidor.';
      } else { sessaoAtiva = null; mudarEstado('sem-ligacao'); }
      return;
    }
    if (resposta.status === 401) { ao401(); return; }
    if (!resposta.ok) { mostrarNotificacao('Erro do servidor ao verificar sessão. Tente novamente.', 'aviso'); return; }
    await entrarComSessao(await resposta.json());
  });
}

// =============================================================================
// 4. ENTRADA (POST /v2/sessao)
// =============================================================================

formLogin.addEventListener('submit', evento => { evento.preventDefault(); comBloqueioSessao(() => processarLogin(evento)).catch(e => mostrarErroLogin(e.message)); });
async function processarLogin(evento) {
  evento.preventDefault();
  erroLogin.hidden = true;

  const utilizador = campoUtilizador.value.trim();
  const palavraPasse = campoPalavraPasse.value;

  btnEntrar.disabled = true;
  const textoOriginal = btnEntrar.textContent;
  btnEntrar.textContent = 'A entrar…';

  try {
    const resposta = await fetch('/v2/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utilizador, palavraPasse })
    });

    if (resposta.ok) {
      const dados = await resposta.json();

      // Se mudou de utilizador, apagar dados locais do anterior
      const proprietarioAnterior = await lerProprietario();
      if (proprietarioAnterior && proprietarioAnterior.utilizador !== dados.utilizador) {
        await limparBD();
      }

      await entrarComSessao(dados);
    } else {
      const corpo = await resposta.json();
      erroLogin.textContent = corpo.mensagem || 'Erro de autenticação.';
      erroLogin.hidden = false;
      campoPalavraPasse.value = '';
      campoPalavraPasse.focus();
    }
  } catch (_) {
    mudarEstado('sem-ligacao');
    msgSemLigacao.textContent = 'Sem ligação: não é possível entrar.';
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = textoOriginal;
  }
}

// =============================================================================
// 5. ENTRAR COM SESSÃO (após autenticação bem-sucedida)
// =============================================================================

async function entrarComSessao(dadosSessao) {
  geracaoUI++;
  const anterior = await lerProprietario();
  if (anterior && anterior.utilizador !== dadosSessao.utilizador) { limparRascunho(); formSugestao.reset(); }
  dadosSessao.expiracao = expiracaoMs(dadosSessao.expiracao);
  sessaoAtiva = dadosSessao;
  campoPalavraPasse.value = '';

  // Guardar em meta para uso do SW sem cookie
  await guardarProprietario({
    utilizador: dadosSessao.utilizador,
    nome: dadosSessao.nome,
    papel: dadosSessao.papel,
    expiracao: dadosSessao.expiracao
  });

  tituloBoasVindas.textContent = `Bem-vindo(a), ${dadosSessao.nome}!`;
  mudarEstado('com-sessao');
  tituloBoasVindas.focus();
  iniciarContagemRegressiva(dadosSessao.expiracao);

  formSugestao.hidden = dadosSessao.papel !== 'aluno';
  await mostrarDadosLocais();
  await carregarCategorias();
  pedirSync();
}

// =============================================================================
// 6. SAÍDA (DELETE /v2/sessao)
// =============================================================================

btnTerminarSessao.addEventListener('click', async () => {
  const totalPendentes = sessaoAtiva
    ? await contarPendentes(sessaoAtiva.utilizador)
    : 0;

  if (totalPendentes > 0) {
    msgConfirmarLogout.textContent = `Há ${totalPendentes} sugestão(ões) por enviar. Se terminar a sessão agora, serão apagadas localmente. Deseja continuar?`;
    dialogConfirmarLogout.showModal();
  } else {
    await terminarSessao();
  }
});

btnCancelarLogout.addEventListener('click', () => dialogConfirmarLogout.close());
btnConfirmarLogout.addEventListener('click', async () => {
  dialogConfirmarLogout.close();
  await terminarSessao();
});

async function terminarSessao() {
  if (corpo.dataset.estado !== 'com-sessao') return;
  return comBloqueioSessao(async () => {
    try {
      const resposta = await fetch('/v2/sessao', { method: 'DELETE' });
      if (resposta.status !== 204) { mostrarNotificacao('O servidor não confirmou o logout. Os dados foram preservados.', 'aviso'); return; }
    } catch {
      mudarEstado('sem-ligacao'); mostrarNotificacao('Sem ligação: não foi possível terminar sessão. Os dados foram preservados.', 'aviso'); return;
    }
    geracaoUI++; clearInterval(temporizadorSessao); cancelarPlanoB();
    await limparBD(); limparRascunho(); formSugestao.reset(); sessaoAtiva = null;
    listaSugestoes.textContent = ''; mudarEstado('sem-sessao'); campoUtilizador.focus();
  });
}

// =============================================================================
// 7. EXPIRAÇÃO DE SESSÃO
// =============================================================================

function iniciarContagemRegressiva(expiracaoMs) {
  clearInterval(temporizadorSessao);
  atualizarContador(expiracaoMs);
  temporizadorSessao = setInterval(() => {
    const restante = expiracaoMs - Date.now();
    if (restante <= 0) {
      clearInterval(temporizadorSessao);
      ao401();
    } else {
      atualizarContador(expiracaoMs);
    }
  }, 1000);
}

function atualizarContador(expiracaoMs) {
  const restante = Math.max(0, expiracaoMs - Date.now());
  const minutos  = Math.floor(restante / 60000);
  const segundos = Math.floor((restante % 60000) / 1000);
  contadorSessao.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

function ao401(mensagem = 'A sessão expirou. Entre de novo.') {
  geracaoUI++; sessaoAtiva = null;
  clearInterval(temporizadorSessao);
  cancelarPlanoB();
  mudarEstado('sem-sessao');
  mostrarErroLogin(mensagem);
  campoUtilizador.focus();
}

function mostrarErroLogin(msg) {
  erroLogin.textContent = msg;
  erroLogin.hidden = false;
}

// =============================================================================
// 8. EVENTOS DE LIGAÇÃO
// =============================================================================

window.addEventListener('online', () => {
  indicadorLigacao.textContent = 'A tentar contactar o servidor…';
  verificarSessao().catch(e => mostrarNotificacao(e.message, 'aviso'));
});

window.addEventListener('offline', () => {
  indicadorLigacao.textContent = 'Sem ligação';
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && sessaoAtiva) {
    verificarSessao().catch(e => mostrarNotificacao(e.message, 'aviso'));
  }
});

btnTentarNovamente.addEventListener('click', () => {
  mudarEstado('a-verificar');
  verificarSessao();
});

// =============================================================================
// 9. PEDIDO DE SINCRONIZAÇÃO (substitui enviarPendentes())
// =============================================================================

async function pedirSync() {
  if (!swRegistado) return;
  if (!sessaoAtiva || Date.now() >= expiracaoMs(sessaoAtiva.expiracao)) return;
  const registo = await navigator.serviceWorker.ready;

  if ('sync' in registo) {
    try {
      await registo.sync.register(ETIQUETA_SYNC);
      usarPlanoB = false;
      return; // O SW trata do resto (incluindo plano B automático)
    } catch (_) {
      // Permissão recusada: usar plano B
    }
  }

  usarPlanoB = true;
  // Plano B: enviar mensagem diretamente ao SW ativo
  if (registo.active) {
    registo.active.postMessage({ tipo: 'sincronizar' });
  }
}

// Sincronização manual
btnSincronizarManual.addEventListener('click', () => pedirSync());

// =============================================================================
// 10. PLANO B — Backoff Exponencial (para browsers sem Background Sync)
// =============================================================================

function agendarPlanoB() {
  if (agendamentoPlanoB !== null) return;
  const espera = Math.min(60, Math.pow(2, Math.max(0, falhasPlanoB - 1))) * (0.7 + 0.6 * Math.random()) * 1000;
  console.log(`[Plano B] Próxima tentativa em ${(espera / 1000).toFixed(1)}s (falha #${falhasPlanoB})`);
  agendamentoPlanoB = setTimeout(() => { agendamentoPlanoB = null; pedirSync(); }, espera);
}

function cancelarPlanoB() {
  if (agendamentoPlanoB !== null) {
    clearTimeout(agendamentoPlanoB);
    agendamentoPlanoB = null;
  }
}

// =============================================================================
// 11. RECEPÇÃO DE MENSAGENS DO SERVICE WORKER
// =============================================================================

async function tratarMensagemSW(dados) {
  if (!dados || !dados.tipo || !sessaoAtiva) return;
  if (dados.utilizador && dados.utilizador !== sessaoAtiva.utilizador) return;

  switch (dados.tipo) {

    case 'sincronizado': {
      if (corpo.dataset.estado === 'sem-ligacao') mudarEstado('com-sessao');
      falhasPlanoB = 0;
      cancelarPlanoB();
      // Atualizar a lista sem recarregar a página
      await atualizarLista();
      // Mostrar notificação de sucesso durante 5 segundos
      const partes = [];
      if (dados.enviadas > 0) partes.push(`${dados.enviadas} enviadas`);
      if (dados.recebidas > 0) partes.push(`${dados.recebidas} recebidas`);
      const textoNotificacao = partes.length > 0
        ? `Sincronizado: ${partes.join(', ')}`
        : 'Sincronizado';
      mostrarNotificacao(textoNotificacao, 'sucesso', 5000);
      break;
    }

    case 'sessao-expirada': {
      cancelarPlanoB();
      const porEnviar = dados.porEnviar || 0;
      if (porEnviar > 0) {
        ao401(`Há ${porEnviar} sugestão(ões) por enviar. Entre de novo para as enviar.`);
      } else {
        ao401('A sessão expirou. Entre de novo.');
      }
      break;
    }

    case 'sem-rede':
    case 'erro-servidor': {
      falhasPlanoB++;
      const porEnviar = dados.porEnviar || 0;
      await atualizarLista();
      mostrarNotificacao(`Por enviar: ${porEnviar}. Nova tentativa automática.`, 'aviso');

      // Plano B: agendar nova tentativa se Background Sync não estiver disponível
      if (swRegistado && usarPlanoB) {
        agendarPlanoB();
      }
      break;
    }
  }
}

// =============================================================================
// 12. SUBMISSÃO DE NOVA SUGESTÃO
// =============================================================================

formSugestao.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  erroSugestao.hidden = true;

  const titulo    = campoTitulo.value.trim();
  const categoria = campoCategoria.value;
  const descricao = campoDescricao.value.trim();

  // Validação cliente (simples)
  if (titulo.length < 5) {
    erroSugestao.textContent = 'O título deve ter pelo menos 5 caracteres.';
    erroSugestao.hidden = false;
    campoTitulo.focus();
    return;
  }

  if (!categoria) {
    erroSugestao.textContent = 'Escolha uma categoria.';
    erroSugestao.hidden = false;
    campoCategoria.focus();
    return;
  }

  if (descricao.length < 10) {
    erroSugestao.textContent = 'A descrição deve ter pelo menos 10 caracteres.';
    erroSugestao.hidden = false;
    campoDescricao.focus();
    return;
  }

  btnSubmeterSugestao.disabled = true;
  const textoOriginal = btnSubmeterSugestao.textContent;
  btnSubmeterSugestao.textContent = 'A submeter…';

  try {
  if (!sessaoAtiva || sessaoAtiva.papel !== 'aluno' || Date.now() >= expiracaoMs(sessaoAtiva.expiracao)) { ao401(); return; }
  const dadosSugestao = { titulo, descricao, categoria };

  // Offline-first: gravar sempre localmente como pendente primeiro
  await acrescentarPendente(dadosSugestao, sessaoAtiva.utilizador);

  // Pedir persitência do armazenamento (apenas na 1ª pendente)
  const totalPendentes = await contarPendentes(sessaoAtiva.utilizador);
  if (totalPendentes === 1 && 'storage' in navigator && 'persist' in navigator.storage) {
    try {
    const persistido = await navigator.storage.persist();
    const estimativa = await navigator.storage.estimate();
    console.log(`[storage.persist()] Resultado: ${persistido}`);
    console.log(`[storage.estimate()] quota=${estimativa.quota}, usage=${estimativa.usage}`);
    } catch (e) { console.warn('Persistência não concedida:', e.message); }
  }

  // Limpar formulário e rascunho
  formSugestao.reset();
  limparRascunho();

  // Atualizar lista imediatamente com o estado local
  await atualizarLista();

  mostrarNotificacao('Sugestão guardada! A sincronizar…', 'sucesso', 4000);

  // Pedir sincronização ao SW
  await pedirSync();

  campoTitulo.focus();
  } catch (e) { erroSugestao.textContent = e.message; erroSugestao.hidden = false; }
  finally { btnSubmeterSugestao.disabled = false; btnSubmeterSugestao.textContent = textoOriginal; }
});

// Guardar rascunho enquanto o utilizador escreve
[campoTitulo, campoDescricao].forEach((campo) => {
  campo.addEventListener('input', () => {
    guardarRascunho({
      titulo: campoTitulo.value,
      descricao: campoDescricao.value
    });
  });
});

// =============================================================================
// 13. CARREGAMENTO DE CATEGORIAS (GET /v2/categorias — via Cache API do SW)
// =============================================================================

async function carregarCategorias() {
  try {
    const resposta = await fetch('/v2/categorias');
    if (resposta.ok) {
      const categorias = await resposta.json();
      preencherSelectCategorias(categorias);
      campoCategoria.disabled = false;
    }
  } catch (_) {
    campoCategoria.disabled = campoCategoria.options.length <= 1;
    // Sem rede: o SW devolve a versão em cache (dados-publicos)
    console.warn('[categorias] A usar versão em cache (sem ligação)');
  }
}

function preencherSelectCategorias(categorias) {
  campoCategoria.textContent = '';
  const opcaoVazia = document.createElement('option');
  opcaoVazia.value = '';
  opcaoVazia.textContent = 'Escolha uma categoria…';
  campoCategoria.appendChild(opcaoVazia);

  for (const cat of categorias) {
    const opcao = document.createElement('option');
    opcao.value = cat.codigo;
    opcao.textContent = cat.nome;
    campoCategoria.appendChild(opcao);
  }
}

// =============================================================================
// 14. ATUALIZAÇÃO DA LISTA DE SUGESTÕES (sem recarregar a página)
// =============================================================================

selectOrdenacao.addEventListener('change', async () => {
  guardarConfiguracoes({ ordenacao: selectOrdenacao.value });
  await atualizarLista();
});

async function atualizarLista() {
  if (!sessaoAtiva || !['com-sessao','sem-ligacao'].includes(corpo.dataset.estado)) return;
  const atual = geracaoUI; const pessoa = sessaoAtiva.utilizador;
  const ordenacao = lerConfiguracoes().ordenacao || 'data_desc';
  const sugestoes = await lerTodasSugestoes(sessaoAtiva.utilizador, ordenacao);
  const pendentes  = await lerTodasPendentes(sessaoAtiva.utilizador);

  if (atual !== geracaoUI || pessoa !== sessaoAtiva?.utilizador) return;
  listaSugestoes.textContent = '';

  if (sugestoes.length === 0 && pendentes.length === 0) {
    const p = document.createElement('p');
    p.className = 'aviso-vazio';
    p.textContent = 'Nenhuma sugestão encontrada. Submeta a primeira!';
    listaSugestoes.appendChild(p);
    return;
  }

  // Renderizar sugestões confirmadas (que já chegaram ao servidor)
  for (const s of sugestoes) {
    listaSugestoes.appendChild(construirCartaoSugestao(s));
  }

  // Renderizar sugestões pendentes (na fila local)
  for (const p of pendentes) {
    listaSugestoes.appendChild(construirCartaoPendente(p));
  }
}

function criarCartao(titulo, descricao, etiqueta, estado, detalhe) {
  const div = document.createElement('div'); div.className = 'cartao-sugestao';
  const topo = document.createElement('div'); topo.className = 'linha-topo';
  const nome = document.createElement('span'); nome.className = 'titulo'; nome.textContent = titulo;
  const badge = document.createElement('span'); badge.className = 'etiqueta'; badge.classList.add('etiqueta-' + estado); badge.textContent = etiqueta;
  const texto = document.createElement('p'); texto.className = 'descricao'; texto.textContent = descricao;
  const info = document.createElement('div'); info.className = 'info-extra'; info.textContent = detalhe;
  topo.append(nome,badge); div.append(topo,texto,info); return div;
}
function construirCartaoSugestao(s) {
  return criarCartao(s.titulo, s.descricao, formatarEstado(s.estado), s.estado,
    `${s.categoria} · ${new Date(s.dataCriacao).toLocaleString('pt-PT')} · v${s.versao}`);
}
function construirCartaoPendente(p) {
  const etiqueta = p.erro ? `Erro: ${p.erro}` : `Por enviar${p.tentativas ? ` (${p.tentativas} tentativas)` : ''}`;
  return criarCartao(p.titulo, p.descricao, etiqueta, p.erro ? 'erro' : 'por-enviar', `Criada em ${new Date(p.criadaEm).toLocaleString('pt-PT')}`);
}

function mostrarDadosLocais() {
  return atualizarLista();
}

// =============================================================================
// 15. ATUALIZAÇÃO DA APLICAÇÃO (new SW em waiting)
// =============================================================================

function mostrarBannerAtualizacao() {
  bannerAtualizacao.hidden = false;
}

btnAtualizarApp.addEventListener('click', () => {
  if (swAEsperar) {
    swAEsperar.postMessage({ tipo: 'ativar' });
    swAEsperar = null;
    bannerAtualizacao.hidden = true;
  }
});

// =============================================================================
// UTILITÁRIOS
// =============================================================================

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarEstado(estado) {
  return {
    'submetida': 'Submetida',
    'em_analise': 'Em análise',
    'aceite': 'Aceite',
    'rejeitada': 'Rejeitada',
    'resolvida': 'Resolvida'
  }[estado] || estado;
}

function mostrarNotificacao(texto, tipo = 'sucesso', duracaoMs = 0) {
  const div = document.createElement('div');
  div.className = `mensagem-notificacao ${tipo}`;
  div.textContent = texto;
  zonaNotificacao.hidden = false;
  zonaNotificacao.appendChild(div);

  if (duracaoMs > 0) {
    setTimeout(() => {
      div.remove();
      if (zonaNotificacao.children.length === 0) {
        zonaNotificacao.hidden = true;
      }
    }, duracaoMs);
  }
}

// Interceptar respostas 401 de qualquer fetch na página
const fetchOriginal = window.fetch;
window.fetch = async (...args) => {
  const resposta = await fetchOriginal(...args);
  if (resposta.status === 401 && corpo.dataset.estado === 'com-sessao') {
    ao401('A sessão expirou. Entre de novo.');
  }
  return resposta;
};

// =============================================================================
// INICIALIZAR AO CARREGAR
// =============================================================================
iniciar().catch(e => mostrarNotificacao(e.message, 'aviso'));
