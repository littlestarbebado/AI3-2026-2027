import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exigirToken, exigirPapel, criarHandlerToken } from './autenticacao.js';
const segredo = process.env.JWT_SEGREDO;
if (!segredo || segredo.length < 32) {
  console.error('JWT_SEGREDO é obrigatório e deve ter pelo menos 32 caracteres aleatórios.');
  process.exit(1);
}
const validade = Number(process.env.JWT_VALIDADE ?? 900);
if (!Number.isSafeInteger(validade) || validade < 1) {
  console.error('JWT_VALIDADE deve ser um inteiro positivo de segundos.');
  process.exit(1);
}
const utilizadores = JSON.parse(await readFile(new URL('./dados/utilizadores.json', import.meta.url), 'utf8'));
const sugestoes = JSON.parse(await readFile(new URL('./dados/sugestoes.json', import.meta.url), 'utf8'));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.post('/v2/tokens', criarHandlerToken({ segredo, validade, utilizadores }));
app.get('/v2/sugestoes', exigirToken(segredo), exigirPapel('aluno', 'servicos'), (req, res) => {
  const itens = sugestoes.filter(s => req.utilizador.papel === 'servicos' || s.numeroAluno === req.utilizador.sub);
  res.set('Cache-Control', 'private, no-cache').json({ pagina: 1, tamanhoPagina: 20, total: itens.length, itens });
});
app.get('/v2/openapi.yaml', (req, res) => res.type('application/yaml').sendFile(fileURLToPath(new URL('../sugestoes.openapi.yaml', import.meta.url))));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
app.use((req, res) => res.set('Cache-Control', 'no-store').status(404).json({ codigo: 404, mensagem: 'Recurso não encontrado.' }));
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  const codigo = ['entity.parse.failed', 'entity.too.large'].includes(erro.type) ? 400 : 500;
  res.set('Cache-Control', 'no-store').status(codigo).json({ codigo, mensagem: codigo === 400 ? 'Corpo JSON inválido.' : 'Erro interno do servidor.' });
});
app.listen(process.env.PORT ?? 3000, () => console.log('Servidor pronto: http://localhost:' + (process.env.PORT ?? 3000)));