/**
 * configuracoes.js
 * Modulo responsavel pela gestao das configuracoes da interface em localStorage.
 */

const CONFIGURACOES_OMISSAO = {
  tema: 'claro',
  ordenacao: 'recentes'
};

const VALORES_VALIDOS = {
  tema: ['claro', 'escuro'],
  ordenacao: ['recentes', 'estado']
};

/**
 * Le as configuracoes guardadas em localStorage.
 * Se a chave nao existir, nao for JSON valido ou tiver valores fora dos permitidos,
 * devolve os valores por omissao.
 * 
 * @returns {{ tema: string, ordenacao: string }}
 */
function lerConfiguracoes() {
  try {
    const raw = localStorage.getItem('configuracoes');
    if (!raw) {
      return { ...CONFIGURACOES_OMISSAO };
    }

    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') {
      return { ...CONFIGURACOES_OMISSAO };
    }

    const tema = VALORES_VALIDOS.tema.includes(obj.tema)
      ? obj.tema
      : CONFIGURACOES_OMISSAO.tema;

    const ordenacao = VALORES_VALIDOS.ordenacao.includes(obj.ordenacao)
      ? obj.ordenacao
      : CONFIGURACOES_OMISSAO.ordenacao;

    return { tema, ordenacao };
  } catch (err) {
    // Em caso de JSON malformatado ou erro de acesso ao localStorage
    return { ...CONFIGURACOES_OMISSAO };
  }
}

/**
 * Guarda o objeto de configuracoes em localStorage.
 * 
 * @param {{ tema: string, ordenacao: string }} configuracoes
 */
function guardarConfiguracoes(configuracoes) {
  try {
    const tema = VALORES_VALIDOS.tema.includes(configuracoes?.tema)
      ? configuracoes.tema
      : CONFIGURACOES_OMISSAO.tema;

    const ordenacao = VALORES_VALIDOS.ordenacao.includes(configuracoes?.ordenacao)
      ? configuracoes.ordenacao
      : CONFIGURACOES_OMISSAO.ordenacao;

    const aGuardar = { tema, ordenacao };
    localStorage.setItem('configuracoes', JSON.stringify(aGuardar));
  } catch (err) {
    console.error('Erro ao guardar configuracoes no localStorage:', err);
  }
}
