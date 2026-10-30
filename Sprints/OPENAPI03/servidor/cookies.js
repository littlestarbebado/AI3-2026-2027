/**
 * Procura o valor de um cookie especifico no cabecalho 'Cookie' do pedido HTTP.
 * O cabecalho Cookie tem o formato: nome1=valor1; nome2=valor2
 *
 * @param {import('express').Request} req - Objeto de pedido Express
 * @param {string} nome - Nome do cookie a procurar
 * @returns {string|null} - Valor do cookie ou null se nao encontrado
 */
function lerCookie(req, nome) {
  const cookieHeader = req.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const pares = cookieHeader.split(';');
  for (const par of pares) {
    const parte = par.trim();
    const indiceIgual = parte.indexOf('=');
    if (indiceIgual !== -1) {
      const chave = parte.substring(0, indiceIgual).trim();
      if (chave === nome) {
        const valor = parte.substring(indiceIgual + 1).trim();
        try {
          return decodeURIComponent(valor);
        } catch {
          return valor;
        }
      }
    }
  }

  return null;
}

module.exports = { lerCookie };
