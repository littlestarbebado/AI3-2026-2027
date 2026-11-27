// pendentes.js — Gestão de rascunhos (sessionStorage) e utilitários de pendentes
const CHAVE_RASCUNHO = 'sugestao_rascunho';

function guardarRascunho(dados) {
  try {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados));
  } catch (_) {}
}

function lerRascunho() {
  try {
    const dados = sessionStorage.getItem(CHAVE_RASCUNHO);
    return dados ? JSON.parse(dados) : null;
  } catch (_) {
    return null;
  }
}

function limparRascunho() {
  try {
    sessionStorage.removeItem(CHAVE_RASCUNHO);
  } catch (_) {}
}
