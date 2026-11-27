let token = null;
let temporizador = null;
let geracao = 0;
const el = id => document.getElementById(id);
const avisar = texto => { el('mensagem').textContent = texto; };
export function descodificarPayload(valor) {
  let parte = valor.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  parte += '='.repeat((4 - parte.length % 4) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parte), c => c.charCodeAt(0))));
}
function terminar(mensagem = '') {
  geracao++;
  token = null;
  clearInterval(temporizador);
  temporizador = null;
  el('sessao').hidden = true;
  el('entrada').hidden = false;
  for (const id of ['nome', 'papel', 'tempo', 'expiracao', 'sugestoes']) el(id).textContent = '';
  el('formulario').reset();
  avisar(mensagem);
}
async function pedidoAutenticado(url) {
  const atual = geracao;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (atual !== geracao) return null;
  if (resposta.status === 401) {
    terminar('Sessão expirada. É necessária nova autenticação.');
    return null;
  }
  const dados = await resposta.json();
  if (atual !== geracao) return null;
  if (resposta.status === 403) throw new Error(dados.mensagem ?? 'Sem permissão para esta operação.');
  if (!resposta.ok) throw new Error(dados.mensagem ?? 'Pedido recusado.');
  return dados;
}
el('formulario').addEventListener('submit', async evento => {
  evento.preventDefault();
  const atual = ++geracao;
  el('entrar').disabled = true;
  avisar('');
  try {
    const resposta = await fetch('/v2/tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utilizador: el('utilizador').value, palavraPasse: el('palavraPasse').value })
    });
    const dados = await resposta.json();
    if (atual !== geracao) return;
    if (!resposta.ok) { avisar(dados.mensagem ?? 'Não foi possível entrar.'); return; }
    const claims = descodificarPayload(dados.token); // Apresentação; só o servidor verifica a assinatura.
    token = dados.token;
    el('palavraPasse').value = '';
    el('entrada').hidden = true;
    el('sessao').hidden = false;
    el('expiracao').textContent = new Date(claims.exp * 1000).toLocaleTimeString('pt-PT');
    el('nome').textContent = claims.nome;
    el('papel').textContent = claims.papel === 'aluno' ? 'Aluno' : 'Serviços';
    el('carregar').textContent = claims.papel === 'aluno' ? 'As minhas sugestões' : 'Todas as sugestões';
    const atualizar = () => {
      const restante = Math.max(0, claims.exp - Math.floor(Date.now() / 1000));
      el('tempo').textContent = restante;
      if (!restante) terminar('Sessão expirada. É necessária nova autenticação.');
    };
    temporizador = setInterval(atualizar, 1000);
    atualizar();
  } catch (erro) {
    if (atual === geracao) avisar(erro instanceof TypeError ? 'Erro de rede. Verifica a ligação ao servidor.' : 'Resposta inválida do servidor.');
  } finally { el('entrar').disabled = false; }
});
el('carregar').addEventListener('click', async () => {
  const atual = geracao;
  avisar('');
  try {
    const dados = await pedidoAutenticado('/v2/sugestoes');
    if (!dados || atual !== geracao) return;
    el('sugestoes').textContent = '';
    for (const sugestao of dados.itens) {
      const item = document.createElement('li');
      item.textContent = `${sugestao.titulo} — ${sugestao.categoria} — ${sugestao.estado}`;
      el('sugestoes').append(item);
    }
    if (!dados.itens.length) avisar('Não há sugestões para apresentar.');
  } catch (erro) {
    if (atual === geracao) avisar(erro instanceof TypeError ? 'Erro de rede. Verifica a ligação ao servidor.' : erro.message);
  }
});
el('sair').addEventListener('click', () => terminar('Sessão terminada.'));