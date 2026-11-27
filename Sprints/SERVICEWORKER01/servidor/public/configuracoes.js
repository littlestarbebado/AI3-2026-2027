const OMISSAO = { tema: 'claro', ordenacao: 'recentes' };
function validar(valor) {
  if (!valor || !['claro', 'escuro'].includes(valor.tema) || !['recentes', 'estado'].includes(valor.ordenacao)) return { ...OMISSAO };
  return { tema: valor.tema, ordenacao: valor.ordenacao };
}
export function lerConfiguracoes() {
  try { return validar(JSON.parse(localStorage.getItem('configuracoes'))); } catch { return { ...OMISSAO }; }
}
export function guardarConfiguracoes(valor) {
  const configuracoes = validar(valor);
  localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
  return configuracoes;
}
