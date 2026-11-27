// configuracoes.js — Gestão de preferências do utilizador em localStorage
const CHAVE_CONFIGURACOES = 'sugestoes_configuracoes';

const CONFIGURACOES_OMISSAO = {
  ordenacao: 'data_desc' // 'data_desc', 'data_asc', 'estado'
};

function lerConfiguracoes() {
  try {
    const dados = localStorage.getItem(CHAVE_CONFIGURACOES);
    const obj = dados ? JSON.parse(dados) : null;
    return { ordenacao: ['data_desc','data_asc','estado'].includes(obj?.ordenacao) ? obj.ordenacao : 'data_desc' };
  } catch (_) {
    return { ...CONFIGURACOES_OMISSAO };
  }
}

function guardarConfiguracoes(novasConfiguracoes) {
  try {
    const atuais = lerConfiguracoes();
    const combinadas = { ...atuais, ...novasConfiguracoes };
    localStorage.setItem(CHAVE_CONFIGURACOES, JSON.stringify(combinadas));
    return combinadas;
  } catch (err) {
    console.error('Erro ao guardar configurações:', err);
    return lerConfiguracoes();
  }
}
