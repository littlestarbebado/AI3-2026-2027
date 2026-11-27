
import { lerPendentes, lerProprietario, confirmarPendente, marcarErro } from './bd.js';
let aEnviar = false;
export async function enviarPendentes({ obterSessao, pedido, aoExpirar, aoMudar }) {
  if (aEnviar) return;
  const sessao = obterSessao();
  if (!sessao) return;
  aEnviar = true;
  try {
    for (const pendente of await lerPendentes()) {
      if (pendente.utilizador !== sessao.utilizador || pendente.erro) continue;
      const dono = await lerProprietario();
      if (obterSessao() !== sessao || dono?.utilizador !== sessao.utilizador) break;
      let resposta;
      try {
        const { titulo, descricao, categoria } = pendente;
        resposta = await pedido('/v2/sugestoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, descricao, categoria }) });
      } catch (e) {
        if (e instanceof TypeError || e.name === 'AbortError') break;
        throw e;
      }
      if (obterSessao() !== sessao) break;
      if (resposta.status === 401) {
        const n = (await lerPendentes()).filter(p => p.utilizador === sessao.utilizador).length;
        aoExpirar(`Há ${n} sugestões por enviar. Entre de novo para as enviar.`);
        break;
      }
      const dados = await resposta.json();
      if (obterSessao() !== sessao) break;
      if (resposta.status === 201) await confirmarPendente(pendente.idLocal, dados, sessao.utilizador);
      else if (resposta.status === 400) await marcarErro(pendente.idLocal, dados.mensagem ?? 'Dados inválidos.', sessao.utilizador);
      else break;
      await aoMudar();
    }
  } finally { aEnviar = false; }
}
export function envioEmCurso() { return aEnviar; }