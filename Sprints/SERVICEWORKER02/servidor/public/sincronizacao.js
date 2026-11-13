// sincronizacao.js — executado exclusivamente no Service Worker
// Sincronização offline-first nos dois sentidos: Push (fila de saída) + Pull (cursor incremental)

async function executarSincronizacao() {
  // 1. Verificar a sessão em meta
  const proprietario = await lerProprietario();
  const porEnviarInicial = proprietario ? await contarPendentes(proprietario.utilizador) : 0;

  if (!proprietario || !proprietario.expiracao || Date.now() >= (typeof proprietario.expiracao === 'number' ? proprietario.expiracao : Date.parse(proprietario.expiracao))) {
    return {
      tipo: 'sessao-expirada',
      porEnviar: porEnviarInicial
    };
  }

  const utilizador = proprietario.utilizador;
  const pendentes = await lerPendentesDe(utilizador);

  let enviadas = 0;
  let recusadas = 0;
  let recebidas = 0;

  // 2. Push: Enviar pendentes uma a uma, por ordem de idLocal
  for (const p of pendentes) {
    await registarTentativa(p.idLocal);

    let resposta;
    try {
      resposta = await fetch('/v2/sugestoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': p.chave
        },
        body: JSON.stringify({
          titulo: p.titulo,
          descricao: p.descricao,
          categoria: p.categoria
        })
      });
    } catch (err) {
      // Erro de rede: fetch rejeitado -> interrompe e lança tipo: 'sem-rede'
      const porEnviar = await contarPendentes(utilizador);
      const erro = new Error('Falha de rede durante o envio');
      erro.tipo = 'sem-rede';
      erro.porEnviar = porEnviar;
      throw erro;
    }

    if (resposta.status >= 500) {
      // Erro no servidor: 5xx -> interrompe e lança tipo: 'erro-servidor'
      const porEnviar = await contarPendentes(utilizador);
      const erro = new Error(`Erro do servidor (${resposta.status})`);
      erro.tipo = 'erro-servidor';
      erro.status = resposta.status;
      erro.porEnviar = porEnviar;
      throw erro;
    }

    if (resposta.status === 401) {
      // Sessão expirou no servidor: pára e devolve sessão expirada
      const porEnviar = await contarPendentes(utilizador);
      return {
        tipo: 'sessao-expirada',
        porEnviar
      };
    }

    if (resposta.status === 201) {
      const sugestaoCriada = await resposta.json();
      await confirmarPendente(p.idLocal, sugestaoCriada, utilizador);
      enviadas++;
    } else if (resposta.status >= 400 && resposta.status < 500) {
      // Erro definitivo do cliente: marcar pendente com erro e continuar para a seguinte
      let msgErro = `Erro ${resposta.status}`;
      try {
        const dadosErro = await resposta.json();
        if (dadosErro.mensagem) {
          msgErro = dadosErro.mensagem;
        }
      } catch (_) {}
      await marcarErro(p.idLocal, msgErro);
      recusadas++;
    } else {
      throw Object.assign(new Error('Resposta inesperada no envio.'), { tipo: 'erro-servidor', porEnviar: await contarPendentes(utilizador) });
    }
  }

  // 3. Pull: Após o push de todas as pendentes, trazer alterações do servidor
  const cursorAtual = await lerCursor(utilizador);
  let respostaPull;
  try {
    respostaPull = await fetch(`/v2/sugestoes/alteracoes?desde=${cursorAtual}`);
  } catch (err) {
    const porEnviar = await contarPendentes(utilizador);
    const erro = new Error('Falha de rede durante o pull de alterações');
    erro.tipo = 'sem-rede';
    erro.porEnviar = porEnviar;
    throw erro;
  }

  if (respostaPull.status >= 500) {
    const porEnviar = await contarPendentes(utilizador);
    const erro = new Error(`Erro do servidor no pull (${respostaPull.status})`);
    erro.tipo = 'erro-servidor';
    erro.status = respostaPull.status;
    erro.porEnviar = porEnviar;
    throw erro;
  }

  if (respostaPull.status === 401) {
    const porEnviar = await contarPendentes(utilizador);
    return {
      tipo: 'sessao-expirada',
      porEnviar
    };
  }

  if (!respostaPull.ok) throw Object.assign(new Error('Pull recusado: ' + respostaPull.status), { tipo: 'erro-servidor', porEnviar: await contarPendentes(utilizador) });
  if (respostaPull.ok) {
    const dados = await respostaPull.json();
    await aplicarAlteracoes(utilizador, dados.alteracoes, dados.cursor);
    recebidas = Array.isArray(dados.alteracoes) ? dados.alteracoes.length : 0;
  }

  const porEnviarFinal = await contarPendentes(utilizador);

  return {
    tipo: 'sincronizado',
    utilizador,
    enviadas,
    recusadas,
    recebidas,
    porEnviar: porEnviarFinal
  };
}
