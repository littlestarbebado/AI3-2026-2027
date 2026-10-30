const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { lerCookie } = require('./cookies');

const app = express();
const PORT = process.env.PORT || 3000;
const SEGREDO_JWT = process.env.SEGREDO_JWT || 'chave_secreta_jwt_para_assinatura_de_tokens_sugestoes_api';

app.use(express.json());

// Middleware para capturar erros de JSON malformatado
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).set('Cache-Control', 'no-store').json({ erro: 'JSON malformatado' });
  }
  next(err);
});

// Servir os ficheiros estaticos da interface web do cliente
app.use(express.static(path.join(__dirname, 'cliente')));

// Utilizadores mock em memoria com palavras-passe encriptadas com bcrypt
// Palavra-passe para ambos: "segredo123"
const hashPadrao = bcrypt.hashSync('segredo123', 10);

const utilizadores = [
  {
    utilizador: 'ana',
    nome: 'Ana Marques',
    papel: 'aluno',
    numeroAluno: '28377',
    hash: hashPadrao
  },
  {
    utilizador: 'bruno',
    nome: 'Bruno Silva',
    papel: 'docente',
    numeroAluno: null,
    hash: hashPadrao
  }
];

// Base de sugestoes em memoria
let proximoIdSugestao = 4;
const sugestoes = [
  {
    id: 1,
    numeroAluno: '28377',
    texto: 'Disponibilizar mais tomadas para portateis na sala de estudo.',
    data: '2026-10-21T10:00:00.000Z',
    estado: 'submetida'
  },
  {
    id: 2,
    numeroAluno: '28377',
    texto: 'Melhorar a conexao Wi-Fi no bloco B.',
    data: '2026-10-22T14:30:00.000Z',
    estado: 'em_analise'
  },
  {
    id: 3,
    numeroAluno: '29100',
    texto: 'Organizar um torneio de xadrez na semana de acolhimento.',
    data: '2026-10-22T17:00:00.000Z',
    estado: 'submetida'
  }
];

/**
 * Middleware para autenticacao e extracao do token JWT.
 * Aceita o token no cabecalho 'Authorization: Bearer <token>' OU
 * no cookie 'sessao' atraves da funcao lerCookie.
 */
function exigirToken(req, res, next) {
  let token = null;

  // 1. Tentar ler do cabecalho Authorization (API02)
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Se nao existir no cabecalho, tentar ler do cookie 'sessao' (API03)
  if (!token) {
    token = lerCookie(req, 'sessao');
  }

  if (!token) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Autenticacao necessaria: token nao fornecido' });
  }

  try {
    const payload = jwt.verify(token, SEGREDO_JWT);
    req.utilizador = payload;
    next();
  } catch (err) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Token invalido ou expirado' });
  }
}

// -----------------------------------------------------------------------------
// ROTAS DE AUTENTICACAO E SESSAO (/v2/sessao)
// -----------------------------------------------------------------------------

/**
 * POST /v2/sessao
 * Autentica o utilizador e define o cookie 'sessao' HttpOnly.
 */
app.post('/v2/sessao', (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};

  if (!utilizador || !palavraPasse) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Campos utilizador e palavraPasse sao obrigatorios' });
  }

  const user = utilizadores.find(u => u.utilizador === utilizador);
  if (!user || !bcrypt.compareSync(palavraPasse, user.hash)) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais invalidas' });
  }

  // Duracao do token: 900 segundos (15 minutos)
  const duracaoSegundos = 900;
  const token = jwt.sign(
    {
      utilizador: user.utilizador,
      nome: user.nome,
      papel: user.papel,
      numeroAluno: user.numeroAluno
    },
    SEGREDO_JWT,
    { expiresIn: duracaoSegundos }
  );

  // Em Express, maxAge e especificado em MILISSEGUNDOS (900 * 1000 = 900000 ms)
  res.cookie('sessao', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/v2',
    maxAge: duracaoSegundos * 1000
  });

  const expiracao = new Date(Date.now() + duracaoSegundos * 1000).toISOString();

  res.status(200)
    .set('Cache-Control', 'no-store')
    .json({
      utilizador: user.utilizador,
      nome: user.nome,
      papel: user.papel,
      expiracao
    });
});

/**
 * GET /v2/sessao
 * Retorna os dados da sessao do utilizador autenticado.
 */
app.get('/v2/sessao', exigirToken, (req, res) => {
  const expiracao = new Date(req.utilizador.exp * 1000).toISOString();

  res.status(200)
    .set('Cache-Control', 'no-store')
    .json({
      utilizador: req.utilizador.utilizador,
      nome: req.utilizador.nome,
      papel: req.utilizador.papel,
      expiracao
    });
});

/**
 * DELETE /v2/sessao
 * Apaga o cookie 'sessao' no browser e termina a sessao.
 */
app.delete('/v2/sessao', (req, res) => {
  res.clearCookie('sessao', { path: '/v2' });
  res.status(204)
    .set('Cache-Control', 'no-store')
    .end();
});

/**
 * POST /v2/tokens (Retrocompatibilidade com API02)
 */
app.post('/v2/tokens', (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};

  if (!utilizador || !palavraPasse) {
    return res.status(400).json({ erro: 'Campos utilizador e palavraPasse sao obrigatorios' });
  }

  const user = utilizadores.find(u => u.utilizador === utilizador);
  if (!user || !bcrypt.compareSync(palavraPasse, user.hash)) {
    return res.status(401).json({ erro: 'Credenciais invalidas' });
  }

  const token = jwt.sign(
    {
      utilizador: user.utilizador,
      nome: user.nome,
      papel: user.papel,
      numeroAluno: user.numeroAluno
    },
    SEGREDO_JWT,
    { expiresIn: 900 }
  );

  res.status(200).json({ token });
});

// -----------------------------------------------------------------------------
// ROTAS DE SUGESTOES (/v2/sugestoes)
// -----------------------------------------------------------------------------

/**
 * GET /v2/sugestoes
 * Devolve as sugestoes do aluno autenticado (ou todas se for docente).
 */
app.get('/v2/sugestoes', exigirToken, (req, res) => {
  if (req.utilizador.papel === 'aluno') {
    const minhasSugestoes = sugestoes.filter(s => s.numeroAluno === req.utilizador.numeroAluno);
    return res.status(200).json(minhasSugestoes);
  }

  // Se docente ou outro papel
  res.status(200).json(sugestoes);
});

/**
 * POST /v2/sugestoes
 * Cria uma sugestao associada ao numeroAluno do utilizador autenticado.
 * Apenas utilizadores com papel 'aluno' sao autorizados.
 */
app.post('/v2/sugestoes', exigirToken, (req, res) => {
  if (req.utilizador.papel !== 'aluno') {
    return res.status(403).json({ erro: 'Apenas alunos podem submeter sugestoes' });
  }

  const { texto } = req.body || {};
  if (!texto || typeof texto !== 'string' || texto.trim().length < 5) {
    return res.status(400).json({ erro: 'O texto da sugestao deve ter no minimo 5 caracteres' });
  }

  const novaSugestao = {
    id: proximoIdSugestao++,
    numeroAluno: req.utilizador.numeroAluno,
    texto: texto.trim(),
    data: new Date().toISOString(),
    estado: 'submetida'
  };

  sugestoes.push(novaSugestao);
  res.status(201).json(novaSugestao);
});

app.listen(PORT, () => {
  console.log(`Servidor de Sugestoes v2.1.0 em execucao na porta ${PORT}`);
});
