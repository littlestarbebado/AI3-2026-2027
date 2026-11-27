import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuração e variáveis de ambiente
const porta = Number(process.env.PORTA ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error('PORTA inválida.');
const segredo = process.env.JWT_SEGREDO;
if (!segredo || segredo.length < 32) {
  console.error('Erro fatal: JWT_SEGREDO deve ter pelo menos 32 caracteres.');
  process.exit(1);
}
const validade = Number(process.env.JWT_VALIDADE ?? 900);
if (!Number.isSafeInteger(validade) || validade < 1) throw new Error('JWT_VALIDADE deve ser inteiro positivo.');

// Variáveis de simulação para ensaios da ficha API05
const simularPerdaResposta = process.env.SIMULAR_PERDA_RESPOSTA === '1';
let contador503 = Number(process.env.SIMULAR_503 ?? 0);
if (!Number.isSafeInteger(contador503) || contador503 < 0) throw new Error('SIMULAR_503 deve ser inteiro não negativo.');

// Carregar dados de teste
const utilizadores = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dados', 'utilizadores.json'), 'utf-8')
);
const sugestoes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dados', 'sugestoes.json'), 'utf-8')
);

// Garantir que todas as sugestões têm uma versão positiva sequencial
let versaoGlobal = 1;
for (const sugestao of sugestoes) {
  if (!Number.isSafeInteger(sugestao.versao) || sugestao.versao < versaoGlobal) sugestao.versao = versaoGlobal;
  versaoGlobal = sugestao.versao + 1;
}

// Categorias públicas da aplicação
const categorias = [
  { codigo: 'instalacoes', nome: 'Instalações e Equipamentos' },
  { codigo: 'ensino', nome: 'Ensino e Avaliação' },
  { codigo: 'servicos', nome: 'Serviços e Apoio' },
  { codigo: 'atividades', nome: 'Atividades e Convívio' },
  { codigo: 'outra', nome: 'Outras sugestões' }
];

// Registo de idempotência em memória indexado por "numeroAluno:chave"
// Guarda: { corpoHash, status, location, corpoResposta, timestamp } durante 24 horas
const chavesIdempotencia = new Map();
const TTL_IDEMPOTENCIA_MS = 24 * 60 * 60 * 1000;

function limparChavesExpiradas() {
  const agora = Date.now();
  for (const [chave, entrada] of chavesIdempotencia.entries()) {
    if (agora - entrada.timestamp > TTL_IDEMPOTENCIA_MS) {
      chavesIdempotencia.delete(chave);
    }
  }
}
setInterval(limparChavesExpiradas, 60 * 60 * 1000).unref();

// Hash dummy para mitigar timing attacks quando o utilizador não existe
const HASH_DUMMY = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5F7/m9X2zW6A6H/E6jV7V1uN3Hq6a';

const app = express();
app.use(express.json());

// Servir ficheiros estáticos da PWA
app.use(express.static(path.join(__dirname, 'public'), { setHeaders(res, file) { if (file.endsWith('sw.js')) res.set('Cache-Control', 'no-cache'); } }));

// Servir contrato OpenAPI 2.2.0
app.get('/v2/openapi.yaml', (req, res) => {
  const caminhoContrato = path.join(__dirname, '..', 'sugestoes.openapi.yaml');
  if (fs.existsSync(caminhoContrato)) {
    res.type('text/yaml; charset=utf-8').sendFile(caminhoContrato);
  } else {
    res.status(404).set('Cache-Control', 'no-store').json({
      codigo: 404,
      mensagem: 'Contrato sugestoes.openapi.yaml não encontrado'
    });
  }
});

// Extração do cookie HttpOnly "sessao" sem bibliotecas externas
function obterCookieSessao(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const pares = cookieHeader.split(';');
  for (const par of pares) {
    const [nome, ...resto] = par.trim().split('=');
    if (nome === 'sessao') {
      return resto.join('=');
    }
  }
  return null;
}

// Middleware de verificação de autenticação via cookie
function exigirSessao(req, res, next) {
  const token = obterCookieSessao(req);
  if (!token) {
    return res.status(401).set('Cache-Control', 'private, no-store').json({
      codigo: 401,
      mensagem: 'Não autenticado: cookie de sessão ausente'
    });
  }

  jwt.verify(token, segredo, { algorithms: ['HS256'] }, (err, decodificado) => {
    if (err || typeof decodificado?.sub !== 'string' || !['aluno', 'servicos'].includes(decodificado?.papel)) {
      return res.status(401).set('Cache-Control', 'private, no-store').json({
        codigo: 401,
        mensagem: 'Sessão inválida ou expirada'
      });
    }
    req.utilizador = decodificado;
    next();
  });
}

// -------------------------------------------------------------
// ENDPOINTS DE AUTENTICAÇÃO E SESSÃO (/v2/sessao)
// -------------------------------------------------------------

// GET /v2/sessao - Verificar sessão ativa
app.get('/v2/sessao', exigirSessao, (req, res) => {
  return res.status(200).set('Cache-Control', 'private, no-store').json({
    utilizador: req.utilizador.sub,
    nome: req.utilizador.nome,
    papel: req.utilizador.papel,
    expiracao: req.utilizador.exp * 1000
  });
});

// POST /v2/sessao - Iniciar sessão (login)
app.post('/v2/sessao', async (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};
  const detalhes = [];

  const padraoUtilizador = /^(\d{5,8}|[a-z]+\.[a-z]+)$/;
  if (typeof utilizador !== 'string' || !padraoUtilizador.test(utilizador)) {
    detalhes.push({
      campo: 'utilizador',
      problema: 'Deve ser número de aluno (5 a 8 dígitos) ou nome.apelido em minúsculas'
    });
  }

  if (typeof palavraPasse !== 'string' || palavraPasse.length < 8 || palavraPasse.length > 128) {
    detalhes.push({
      campo: 'palavraPasse',
      problema: 'Deve ter entre 8 e 128 caracteres'
    });
  }

  if (detalhes.length > 0) {
    return res.status(400).set('Cache-Control', 'no-store').json({
      codigo: 400,
      mensagem: 'Dados de credenciais inválidos',
      detalhes
    });
  }

  const utilizadorEncontrado = utilizadores.find(u => u.utilizador === utilizador);
  const hashParaComparar = utilizadorEncontrado ? utilizadorEncontrado.hashPalavraPasse : HASH_DUMMY;
  const palavraPasseCorreta = await bcrypt.compare(palavraPasse, hashParaComparar);

  if (!utilizadorEncontrado || !palavraPasseCorreta) {
    return res.status(401).set('Cache-Control', 'no-store').json({
      codigo: 401,
      mensagem: 'Credenciais inválidas'
    });
  }

  const agoraSegundos = Math.floor(Date.now() / 1000);
  const expiraEmSegundos = agoraSegundos + validade;

  const token = jwt.sign(
    {
      sub: utilizadorEncontrado.utilizador,
      nome: utilizadorEncontrado.nome,
      papel: utilizadorEncontrado.papel,
      iat: agoraSegundos,
      exp: expiraEmSegundos
    },
    segredo,
    { algorithm: 'HS256' }
  );

  res.setHeader(
    'Set-Cookie',
    `sessao=${token}; HttpOnly; SameSite=Strict; Path=/v2; Max-Age=${validade}`
  );

  return res.status(200).set('Cache-Control', 'no-store').json({
    utilizador: utilizadorEncontrado.utilizador,
    nome: utilizadorEncontrado.nome,
    papel: utilizadorEncontrado.papel,
    expiracao: expiraEmSegundos * 1000
  });
});

// DELETE /v2/sessao - Terminar sessão (logout)
app.delete('/v2/sessao', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    'sessao=; HttpOnly; SameSite=Strict; Path=/v2; Max-Age=0'
  );
  return res.status(204).set('Cache-Control', 'no-store').end();
});

// -------------------------------------------------------------
// ENDPOINTS DE DADOS PÚBLICOS (/v2/categorias)
// -------------------------------------------------------------

// GET /v2/categorias - Categorias públicas em cache
app.get('/v2/categorias', (req, res) => {
  return res.status(200).set('Cache-Control', 'public, max-age=86400').json(categorias);
});

// -------------------------------------------------------------
// ENDPOINTS DE SUGESTÕES (/v2/sugestoes)
// -------------------------------------------------------------

// GET /v2/sugestoes - Listar todas as sugestões (compatibilidade com API04)
app.get('/v2/sugestoes', exigirSessao, (req, res) => {
  let lista = sugestoes;
  if (req.utilizador.papel === 'aluno') {
    lista = sugestoes.filter(s => s.numeroAluno === req.utilizador.sub);
  }

  return res.status(200).set('Cache-Control', 'private, no-cache').json({
    pagina: 1,
    tamanhoPagina: 20,
    total: lista.length,
    itens: lista
  });
});

// Validador de formato UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Comparação estrutural: a ordem das propriedades JSON não altera o corpo lógico.
function corpoCanonico(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(corpoCanonico).join(',') + ']';
  if (valor && typeof valor === 'object') return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + corpoCanonico(valor[k])).join(',') + '}';
  return JSON.stringify(valor);
}

// POST /v2/sugestoes - Criar sugestão com Idempotência
app.post('/v2/sugestoes', exigirSessao, (req, res) => {
  if (req.utilizador.papel !== 'aluno') return res.status(403).set('Cache-Control', 'no-store').json({ codigo: 403, mensagem: 'Apenas alunos podem criar sugestões.' });
  limparChavesExpiradas();
  // Simulação de falha temporária 503
  if (contador503 > 0) {
    contador503--;
    return res.status(503).set({
      'Retry-After': '2',
      'Cache-Control': 'no-store'
    }).json({
      codigo: 503,
      mensagem: 'Serviço temporariamente indisponível (simulação de 503)'
    });
  }

  const chaveIdempotencia = req.headers['idempotency-key'];
  const utilizadorId = req.utilizador.sub;

  // Validação da Idempotency-Key caso seja fornecida
  if (chaveIdempotencia !== undefined) {
    if (typeof chaveIdempotencia !== 'string' || !UUID_REGEX.test(chaveIdempotencia)) {
      return res.status(400).set('Cache-Control', 'no-store').json({
        codigo: 400,
        mensagem: 'O cabeçalho Idempotency-Key deve ser um UUID válido',
        detalhes: [
          { campo: 'Idempotency-Key', problema: 'Não respeita o formato UUID (RFC 4122)' }
        ]
      });
    }

    const mapaChave = `${utilizadorId}:${chaveIdempotencia.toLowerCase()}`;
    if (chavesIdempotencia.has(mapaChave)) {
      const entradaGuardada = chavesIdempotencia.get(mapaChave);
      const corpoAtual = corpoCanonico(req.body);

      if (entradaGuardada.corpoHash === corpoAtual) {
        // Chave repetida com corpo idêntico: devolve a resposta guardada com Idempotent-Replayed: true
        return res
          .status(entradaGuardada.status)
          .set({
            Location: entradaGuardada.location,
            'Cache-Control': 'no-store',
            'Idempotent-Replayed': 'true'
          })
          .json(entradaGuardada.corpoResposta);
      } else {
        // Chave repetida com corpo diferente: 409 Conflict
        return res.status(409).set('Cache-Control', 'no-store').json({
          codigo: 409,
          mensagem: 'A chave de idempotência já foi utilizada com um corpo diferente.'
        });
      }
    }
  }

  // Validação do corpo da sugestão
  const { titulo, descricao, categoria } = req.body || {};
  const detalhes = [];

  if (typeof titulo !== 'string' || titulo.trim().length < 5 || titulo.trim().length > 100) {
    detalhes.push({
      campo: 'titulo',
      problema: 'Deve ter entre 5 e 100 caracteres'
    });
  }

  if (typeof descricao !== 'string' || descricao.trim().length < 10 || descricao.trim().length > 1000) {
    detalhes.push({
      campo: 'descricao',
      problema: 'Deve ter entre 10 e 1000 caracteres'
    });
  }

  if (!categorias.some(c => c.codigo === categoria)) {
    detalhes.push({
      campo: 'categoria',
      problema: 'Categoria inexistente ou inválida'
    });
  }

  if (detalhes.length > 0) {
    // Atenção: validação com 400 NÃO guarda chave de idempotência
    return res.status(400).set('Cache-Control', 'no-store').json({
      codigo: 400,
      mensagem: 'Dados da sugestão inválidos',
      detalhes
    });
  }

  // Criação atómica da sugestão
  const novoId = sugestoes.length > 0 ? Math.max(...sugestoes.map(s => s.id)) + 1 : 1;
  const novaVersao = versaoGlobal++;
  const agoraISO = new Date().toISOString();

  const novaSugestao = {
    id: novoId,
    versao: novaVersao,
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    categoria,
    numeroAluno: utilizadorId,
    estado: 'submetida',
    dataCriacao: agoraISO,
    dataAtualizacao: agoraISO,
    dataResolucao: null
  };

  sugestoes.push(novaSugestao);

  const locationUrl = `/v2/sugestoes/${novoId}`;

  // Se veio chave de idempotência, guarda após criação com sucesso
  if (chaveIdempotencia) {
    const mapaChave = `${utilizadorId}:${chaveIdempotencia.toLowerCase()}`;
    chavesIdempotencia.set(mapaChave, {
      corpoHash: corpoCanonico(req.body),
      status: 201,
      location: locationUrl,
      corpoResposta: structuredClone(novaSugestao),
      timestamp: Date.now()
    });

    // Simulação de perda de resposta na 1ª vez que a chave é processada
    if (simularPerdaResposta) {
      console.warn(`[SIMULAR_PERDA_RESPOSTA] Chave ${chaveIdempotencia} processada. A destruir socket sem resposta.`);
      req.socket.destroy();
      return;
    }
  }

  return res.status(201).set({
    Location: locationUrl,
    'Cache-Control': 'no-store'
  }).json(novaSugestao);
});

// GET /v2/sugestoes/alteracoes - Sincronização incremental (Pull)
app.get('/v2/sugestoes/alteracoes', exigirSessao, (req, res) => {
  const desdeRaw = req.query.desde;

  if (typeof desdeRaw !== 'string' || !/^\d+$/.test(desdeRaw) || !Number.isSafeInteger(Number(desdeRaw))) {
    return res.status(400).set('Cache-Control', 'private, no-store').json({
      codigo: 400,
      mensagem: 'O parâmetro de consulta "desde" é obrigatório e deve ser um inteiro maior ou igual a 0',
      detalhes: [
        { campo: 'desde', problema: 'Deve ser um número inteiro >= 0' }
      ]
    });
  }

  const desde = parseInt(desdeRaw, 10);
  const utilizadorId = req.utilizador.sub;

  // Filtrar apenas sugestões do utilizador com versão estritamente superior ao cursor fornecido
  const alteracoes = sugestoes.filter(s => {
    const pertence = req.utilizador.papel === 'servicos' || s.numeroAluno === utilizadorId;
    return pertence && s.versao > desde;
  });

  // Ordenar por versão crescente
  alteracoes.sort((a, b) => a.versao - b.versao);

  // O novo cursor é a maior versão devolvida ou o próprio 'desde' se não houver alterações
  const novoCursor = alteracoes.length > 0 ? alteracoes[alteracoes.length - 1].versao : desde;

  return res.status(200).set('Cache-Control', 'private, no-store').json({
    alteracoes,
    cursor: novoCursor
  });
});

// Uma rota desconhecida também devolve o schema Erro.
app.use((req, res) => res.status(404).set('Cache-Control', 'no-store').json({ codigo: 404, mensagem: 'Recurso não encontrado.' }));

// Middleware genérico de tratamento de erros
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).set('Cache-Control', 'no-store').json({
      codigo: 400,
      mensagem: 'Corpo JSON malformado'
    });
  }

  console.error('Erro não tratado:', err);
  return res.status(500).set('Cache-Control', 'no-store').json({
    codigo: 500,
    mensagem: 'Erro interno do servidor'
  });
});

app.listen(porta, () => {
  console.log(`=======================================================`);
  console.log(`Servidor de Sugestões (API05 - SERVICEWORKER02) ativo!`);
  console.log(`URL: http://localhost:${porta}`);
  console.log(`Modo SIMULAR_PERDA_RESPOSTA: ${simularPerdaResposta ? 'ATIVO' : 'inativo'}`);
  console.log(`Modo SIMULAR_503: ${contador503} pedidos`);
  console.log(`=======================================================`);
});
