import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lerCookie } from './cookies.js';

const segredo = process.env.JWT_SEGREDO;
const validade = Number(process.env.JWT_VALIDADE ?? 900);
const porta = Number(process.env.PORT ?? 3000);
if (!segredo || segredo.length < 32) throw new Error('Defina JWT_SEGREDO com pelo menos 32 caracteres aleatórios no .env.');
if (!Number.isSafeInteger(validade) || validade < 1) throw new Error('JWT_VALIDADE deve ser um inteiro positivo.');
if (!Number.isSafeInteger(porta) || porta < 1 || porta > 65535) throw new Error('PORT inválida.');
const utilizadores = JSON.parse(await readFile(new URL('./dados/utilizadores.json', import.meta.url)));
const sugestoes = JSON.parse(await readFile(new URL('./dados/sugestoes.json', import.meta.url)));
const categorias = JSON.parse(await readFile(new URL('./dados/categorias.json', import.meta.url)));
let proximoId = Math.max(0, ...sugestoes.map(s => s.id)) + 1;
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const erro = (res, codigo, mensagem, detalhes) => res.status(codigo).set('Cache-Control', 'no-store').json({ codigo, mensagem, ...(detalhes ? { detalhes } : {}) });
const opcoesCookie = { httpOnly: true, sameSite: 'strict', path: '/v2' };
const sessao = p => ({ utilizador: p.sub, nome: p.nome, papel: p.papel, expiracao: new Date(p.exp * 1000).toISOString() });

function exigirToken(req, res, next) {
  const auth = req.get('Authorization');
  const token = auth === undefined ? lerCookie(req, 'sessao') : /^Bearer ([^\s]+)$/i.exec(auth)?.[1];
  if (!token) { res.set('WWW-Authenticate', 'Bearer'); return erro(res, 401, 'Autenticação necessária.'); }
  try {
    const p = jwt.verify(token, segredo, { algorithms: ['HS256'] });
    if (typeof p.sub !== 'string' || typeof p.nome !== 'string' || !['aluno', 'servicos'].includes(p.papel) || !Number.isFinite(p.exp)) throw new Error();
    req.utilizador = p;
    next();
  } catch {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    return erro(res, 401, 'Token inválido ou expirado.');
  }
}
async function autenticar(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    const { utilizador, palavraPasse } = req.body ?? {};
    const detalhes = [];
    if (typeof utilizador !== 'string' || !/^(\d{5,8}|[a-z]+\.[a-z]+)$/.test(utilizador)) detalhes.push({ campo: 'utilizador', problema: 'Use 5–8 algarismos ou nome.apelido.' });
    if (typeof palavraPasse !== 'string' || [...palavraPasse].length < 8 || [...palavraPasse].length > 128) detalhes.push({ campo: 'palavraPasse', problema: 'Use 8–128 caracteres.' });
    if (detalhes.length) return erro(res, 400, 'Credenciais com formato inválido.', detalhes);
    const pessoa = utilizadores.find(u => u.utilizador === utilizador);
    const correta = await bcrypt.compare(palavraPasse, pessoa?.hashPalavraPasse ?? utilizadores[0].hashPalavraPasse);
    if (!pessoa || !correta) return erro(res, 401, 'Credenciais inválidas.');
    req.token = jwt.sign({ nome: pessoa.nome, papel: pessoa.papel }, segredo, { algorithm: 'HS256', subject: pessoa.utilizador, expiresIn: validade });
    req.sessao = sessao(jwt.verify(req.token, segredo, { algorithms: ['HS256'] }));
    next();
  } catch (e) { next(e); }
}
app.post('/v2/tokens', autenticar, (req, res) => res.json({ token: req.token, tipo: 'Bearer', expiraEm: validade }));
app.post('/v2/sessao', autenticar, (req, res) => {
  res.cookie('sessao', req.token, { ...opcoesCookie, maxAge: validade * 1000 });
  res.json(req.sessao);
});
app.get('/v2/sessao', exigirToken, (req, res) => res.set('Cache-Control', 'no-store').json(sessao(req.utilizador)));
app.delete('/v2/sessao', (req, res) => res.clearCookie('sessao', opcoesCookie).set('Cache-Control', 'no-store').status(204).end());
app.get('/v2/categorias', (req, res) => res.set('Cache-Control', 'public, max-age=86400').json(categorias));
app.get('/v2/sugestoes', exigirToken, (req, res) => {
  const itens = sugestoes.filter(s => req.utilizador.papel === 'servicos' || s.numeroAluno === req.utilizador.sub);
  res.set('Cache-Control', 'private, no-cache').json({ pagina: 1, tamanhoPagina: 20, total: itens.length, itens });
});
app.post('/v2/sugestoes', exigirToken, (req, res) => {
  if (req.utilizador.papel !== 'aluno') return erro(res, 403, 'Apenas alunos podem criar sugestões.');
  const { titulo, descricao, categoria } = req.body ?? {};
  const detalhes = [];
  if (typeof titulo !== 'string' || [...titulo].length < 10 || [...titulo].length > 120) detalhes.push({ campo: 'titulo', problema: 'Use 10–120 caracteres.' });
  if (typeof descricao !== 'string' || [...descricao].length < 20 || [...descricao].length > 2000) detalhes.push({ campo: 'descricao', problema: 'Use 20–2000 caracteres.' });
  if (!categorias.some(c => c.codigo === categoria)) detalhes.push({ campo: 'categoria', problema: 'Escolha uma categoria válida.' });
  if (detalhes.length) return erro(res, 400, 'Sugestão inválida.', detalhes);
  const agora = new Date().toISOString();
  const nova = { id: proximoId++, titulo, descricao, categoria, numeroAluno: req.utilizador.sub, estado: 'submetida', dataCriacao: agora, dataAtualizacao: agora, dataResolucao: null };
  sugestoes.push(nova); // A ficha mantém as criações apenas na memória do processo.
  res.status(201).set('Location', `/v2/sugestoes/${nova.id}`).set('Cache-Control', 'no-store').json(nova);
});
app.get('/v2/openapi.yaml', (req, res) => res.sendFile(fileURLToPath(new URL('../sugestoes.openapi.yaml', import.meta.url))));
app.get('/sw.js', (req, res) => res.set('Cache-Control', 'no-cache').type('text/javascript').sendFile(fileURLToPath(new URL('./public/sw.js', import.meta.url))));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
app.use((req, res) => erro(res, 404, 'Recurso não encontrado.'));
app.use((e, req, res, next) => {
  if (res.headersSent) return next(e);
  const codigo = e.type === 'entity.parse.failed' ? 400 : 500;
  erro(res, codigo, codigo === 400 ? 'Corpo JSON mal formado.' : 'Erro interno do servidor.');
});
app.listen(porta, () => console.log(`Servidor pronto: http://localhost:${porta}`));
