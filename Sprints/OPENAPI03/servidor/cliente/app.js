/**
 * app.js
 * Logica do cliente web para autenticacao por cookie, sugestoes e rascunho.
 * Nota: Nao ha variavel de token nem envio manual do cabecalho Authorization.
 */

// Elementos do DOM
const bodyElement = document.body;
const selectTema = document.getElementById('select-tema');
const selectOrdenacao = document.getElementById('select-ordenacao');
const alertaGlobal = document.getElementById('alerta-global');
const indicadorSessao = document.getElementById('indicador-sessao');

const zonaLogin = document.getElementById('zona-login');
const formLogin = document.getElementById('form-login');
const inputUtilizador = document.getElementById('input-utilizador');
const inputPalavraPasse = document.getElementById('input-palavrapasse');

const zonaSessao = document.getElementById('zona-sessao');
const textoUtilizadorSessao = document.getElementById('texto-utilizador-sessao');
const badgePapel = document.getElementById('badge-papel');
const textoExpiracaoSessao = document.getElementById('texto-expiracao-sessao');
const btnTerminarSessao = document.getElementById('btn-terminar-sessao');

const zonaNovaSugestao = document.getElementById('zona-nova-sugestao');
const formNovaSugestao = document.getElementById('form-nova-sugestao');
const inputSugestaoTexto = document.getElementById('input-sugestao-texto');
const listaSugestoes = document.getElementById('lista-sugestoes');

// Estado local de sugestoes em memoria para reordenacao rapida
let sugestoesCarregadas = [];

// -----------------------------------------------------------------------------
// GESTAO DE CONFIGURACOES (localStorage)
// -----------------------------------------------------------------------------

function aplicarConfiguracoesNaInterface() {
  const config = lerConfiguracoes();

  // 1. Aplicar tema
  selectTema.value = config.tema;
  if (config.tema === 'escuro') {
    bodyElement.classList.add('escuro');
  } else {
    bodyElement.classList.remove('escuro');
  }

  // 2. Aplicar ordenacao
  selectOrdenacao.value = config.ordenacao;
  renderizarSugestoes();
}

selectTema.addEventListener('change', () => {
  const configAtual = lerConfiguracoes();
  configAtual.tema = selectTema.value;
  guardarConfiguracoes(configAtual);
  aplicarConfiguracoesNaInterface();
});

selectOrdenacao.addEventListener('change', () => {
  const configAtual = lerConfiguracoes();
  configAtual.ordenacao = selectOrdenacao.value;
  guardarConfiguracoes(configAtual);
  aplicarConfiguracoesNaInterface();
});

// -----------------------------------------------------------------------------
// MENSAGENS E ALERTAS
// -----------------------------------------------------------------------------

function mostrarAlerta(mensagem, tipo = 'erro') {
  alertaGlobal.textContent = mensagem;
  alertaGlobal.className = `alerta alerta-${tipo}`;
  alertaGlobal.classList.remove('hidden');
  setTimeout(() => {
    alertaGlobal.classList.add('hidden');
  }, 4000);
}

// -----------------------------------------------------------------------------
// GESTAO DO RASCUNHO (sessionStorage)
// -----------------------------------------------------------------------------

function reporRascunho() {
  const rascunho = sessionStorage.getItem('rascunhoSugestao');
  if (rascunho !== null) {
    inputSugestaoTexto.value = rascunho;
  }
}

inputSugestaoTexto.addEventListener('input', (e) => {
  sessionStorage.setItem('rascunhoSugestao', e.target.value);
});

function apagarRascunho() {
  sessionStorage.removeItem('rascunhoSugestao');
  inputSugestaoTexto.value = '';
}

// -----------------------------------------------------------------------------
// GESTAO DA SESSAO (Cookie / GET /v2/sessao, POST /v2/sessao, DELETE /v2/sessao)
// -----------------------------------------------------------------------------

/**
 * Verifica se existe sessao ativa atraves do cookie enviado automaticamente.
 */
async function verificarSessao() {
  try {
    const resposta = await fetch('/v2/sessao');
    if (resposta.ok) {
      const sessao = await resposta.json();
      apresentarAreaSessao(sessao);
      await carregarSugestoes();
    } else {
      apresentarFormularioEntrada();
    }
  } catch (err) {
    console.error('Erro na verificacao de sessao:', err);
    apresentarFormularioEntrada();
  }
}

function apresentarAreaSessao(sessao) {
  indicadorSessao.textContent = 'Autenticado';
  indicadorSessao.style.backgroundColor = 'var(--badge-bg)';
  indicadorSessao.style.color = 'var(--badge-text)';

  textoUtilizadorSessao.textContent = `${sessao.nome} (${sessao.utilizador})`;
  badgePapel.textContent = sessao.papel;

  const dataExp = new Date(sessao.expiracao);
  textoExpiracaoSessao.textContent = `Sessao valida ate: ${dataExp.toLocaleTimeString()} (${dataExp.toLocaleDateString()})`;

  zonaLogin.classList.add('hidden');
  zonaSessao.classList.remove('hidden');

  // Mostrar formulario de sugestoes apenas a alunos
  if (sessao.papel === 'aluno') {
    zonaNovaSugestao.classList.remove('hidden');
    reporRascunho();
  } else {
    zonaNovaSugestao.classList.add('hidden');
  }
}

function apresentarFormularioEntrada() {
  indicadorSessao.textContent = 'Nao autenticado';
  indicadorSessao.style.backgroundColor = '#f1f5f9';
  indicadorSessao.style.color = '#64748b';

  zonaLogin.classList.remove('hidden');
  zonaSessao.classList.add('hidden');
  listaSugestoes.innerHTML = '';
}

// Submissao do formulario de login (POST /v2/sessao)
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const utilizador = inputUtilizador.value.trim();
  const palavraPasse = inputPalavraPasse.value;

  try {
    const resposta = await fetch('/v2/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utilizador, palavraPasse })
    });

    if (resposta.ok) {
      const sessao = await resposta.json();
      inputPalavraPasse.value = '';
      apresentarAreaSessao(sessao);
      await carregarSugestoes();
    } else {
      const erro = await resposta.json();
      mostrarAlerta(erro.erro || 'Falha na autenticacao', 'erro');
    }
  } catch (err) {
    mostrarAlerta('Erro de comunicacao com o servidor', 'erro');
  }
});

// Terminar sessao (DELETE /v2/sessao)
btnTerminarSessao.addEventListener('click', async () => {
  try {
    await fetch('/v2/sessao', { method: 'DELETE' });
    apagarRascunho();
    apresentarFormularioEntrada();
    mostrarAlerta('Sessao terminada com sucesso', 'sucesso');
  } catch (err) {
    mostrarAlerta('Erro ao terminar sessao', 'erro');
  }
});

// -----------------------------------------------------------------------------
// GESTAO DE SUGESTOES (/v2/sugestoes)
// -----------------------------------------------------------------------------

async function carregarSugestoes() {
  try {
    const resposta = await fetch('/v2/sugestoes');
    if (resposta.ok) {
      sugestoesCarregadas = await resposta.json();
      renderizarSugestoes();
    }
  } catch (err) {
    console.error('Erro ao carregar sugestoes:', err);
  }
}

function renderizarSugestoes() {
  if (!sugestoesCarregadas || sugestoesCarregadas.length === 0) {
    listaSugestoes.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Nenhuma sugestao registada.</p>';
    return;
  }

  const config = lerConfiguracoes();
  const listaOrdenada = [...sugestoesCarregadas];

  if (config.ordenacao === 'recentes') {
    listaOrdenada.sort((a, b) => new Date(b.data) - new Date(a.data));
  } else if (config.ordenacao === 'estado') {
    listaOrdenada.sort((a, b) => a.estado.localeCompare(b.estado));
  }

  listaSugestoes.innerHTML = listaOrdenada.map(s => `
    <div class="sugestao-item">
      <div class="sugestao-header">
        <span>Aluno: #${s.numeroAluno} | ${new Date(s.data).toLocaleString()}</span>
        <span class="badge">${s.estado}</span>
      </div>
      <p class="sugestao-texto">${escapeHtml(s.texto)}</p>
    </div>
  `).join('');
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Submeter nova sugestao (POST /v2/sugestoes)
formNovaSugestao.addEventListener('submit', async (e) => {
  e.preventDefault();

  const texto = inputSugestaoTexto.value.trim();
  if (texto.length < 5) {
    mostrarAlerta('A sugestao deve ter pelo menos 5 caracteres', 'erro');
    return;
  }

  try {
    const resposta = await fetch('/v2/sugestoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto })
    });

    if (resposta.status === 201) {
      apagarRascunho();
      mostrarAlerta('Sugestao submetida com sucesso!', 'sucesso');
      await carregarSugestoes();
    } else {
      const erro = await resposta.json();
      mostrarAlerta(erro.erro || 'Erro ao criar sugestao', 'erro');
    }
  } catch (err) {
    mostrarAlerta('Erro de comunicacao ao submeter sugestao', 'erro');
  }
});

// Inicializacao da pagina
aplicarConfiguracoesNaInterface();
verificarSessao();
