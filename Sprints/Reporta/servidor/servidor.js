'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { distanciaEmMetros } = require('./geo.js');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const porta = Number(process.env.PORT || 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error('PORT inválida');
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'segredo-admin-reporta-2026';
const SIMULAR_PERDA_RESPOSTA = process.env.SIMULAR_PERDA_RESPOSTA === '1';
let simular503Contador = Number(process.env.SIMULAR_503 || 0);

// Categorias e raios oficiais de proximidade
const CATEGORIAS = [
  { id: 'buraco', nome: 'Buraco no pavimento', raio: 15 },
  { id: 'semaforo', nome: 'Semáforo avariado', raio: 20 },
  { id: 'iluminacao', nome: 'Iluminação pública', raio: 30 },
  { id: 'sinalizacao', nome: 'Sinalização danificada', raio: 25 },
  { id: 'outro', nome: 'Outro', raio: 20 }
];
const RAIO_CATEGORIAS = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.raio]));
const CATEGORIAS_VALIDAS = new Set(CATEGORIAS.map(c => c.id));

// Estruturas de dados em memória
const ocorrencias = new Map();
const fotografias = new Map();
const chavesIdempotencia = new Map();
const chavesPerdidasSimuladas = new Set();
let contadorVersao = 0;

const DIR_DADOS = path.join(__dirname, 'dados');
const FICHEIRO_DADOS = path.join(DIR_DADOS, 'ocorrencias.json');

// Função de persistência local em JSON
function salvarDados() {
  try {
    if (!fs.existsSync(DIR_DADOS)) {
      fs.mkdirSync(DIR_DADOS, { recursive: true });
    }
    const lista = [];
    for (const o of ocorrencias.values()) {
      const item = { ...o };
      if (fotografias.has(String(o.id))) {
        item._fotografiaBase64 = fotografias.get(String(o.id)).toString('base64');
      }
      lista.push(item);
    }
    const estado = {
      contadorVersao,
      ocorrencias: lista
    };
    fs.writeFileSync(FICHEIRO_DADOS, JSON.stringify(estado, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao guardar dados no ficheiro JSON:', err.message);
  }
}

function carregarDados() {
  try {
    if (!fs.existsSync(FICHEIRO_DADOS)) return;
    const conteudo = fs.readFileSync(FICHEIRO_DADOS, 'utf-8');
    const estado = JSON.parse(conteudo);
    contadorVersao = estado.contadorVersao || 0;
    if (Array.isArray(estado.ocorrencias)) {
      for (const item of estado.ocorrencias) {
        if (item._fotografiaBase64) {
          fotografias.set(String(item.id), Buffer.from(item._fotografiaBase64, 'base64'));
          delete item._fotografiaBase64;
        }
        item.cidadaos = Array.isArray(item.cidadaos) ? item.cidadaos : [];
        ocorrencias.set(String(item.id), item);
      }
    }
    console.log(`Dados carregados do JSON: ${ocorrencias.size} ocorrências, versão ${contadorVersao}`);
  } catch (err) {
    console.error('Erro ao carregar dados do ficheiro JSON:', err.message);
  }
}

carregarDados();

// Limpeza de chaves de idempotência antigas (> 24h)
function limparChavesIdempotencia() {
  const agora = Date.now();
  const limite = 24 * 60 * 60 * 1000;
  for (const [k, v] of chavesIdempotencia.entries()) {
    if (agora - v.timestamp > limite) {
      chavesIdempotencia.delete(k);
    }
  }
}
setInterval(limparChavesIdempotencia, 60 * 60 * 1000).unref();

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(str) {
  return typeof str === 'string' && REGEX_UUID.test(str.trim());
}

function responderErro(res, status, erro, mensagem, cacheControl = 'no-store') {
  return res.status(status).set('Cache-Control', cacheControl).json({ erro, mensagem });
}

function formatarOcorrencia(o) {
  return {
    id: o.id,
    categoria: o.categoria,
    descricao: o.descricao,
    localizacao: {
      lat: o.localizacao.lat,
      lng: o.localizacao.lng,
      precisao: o.localizacao.precisao
    },
    temFotografia: Boolean(o.temFotografia),
    estado: o.estado,
    comunicacoes: o.comunicacoes,
    criadaEm: o.criadaEm,
    atualizadaEm: o.atualizadaEm,
    versao: o.versao
  };
}

// Middleware de autenticação de cidadão
function exigirCidadao(req, res, next) {
  const cidadao = req.get('X-Cidadao');
  if (!cidadao || !isUUID(cidadao)) {
    return responderErro(res, 401, 'IDENTIFICACAO_INVALIDA', 'Cabeçalho X-Cidadao em falta ou com formato inválido (deve ser UUID).');
  }
  req.cidadaoId = cidadao.trim().toLowerCase();
  next();
}

// Função pura para procurar semelhantes
function procurarSemelhantes(categoria, localizacao, excluir = []) {
  const raio = RAIO_CATEGORIAS[categoria];
  if (typeof raio !== 'number') return [];
  const setExcluir = new Set((excluir || []).map(String));

  const candidatas = [];
  for (const o of ocorrencias.values()) {
    if (o.categoria !== categoria) continue;
    if (o.estado === 'resolvida') continue;
    if (setExcluir.has(String(o.id))) continue;

    const distancia = distanciaEmMetros(localizacao, o.localizacao);
    if (distancia <= raio) {
      candidatas.push({ ocorrencia: o, distancia });
    }
  }

  candidatas.sort((a, b) => a.distancia - b.distancia);
  return candidatas;
}

// ---------------- 1. GET /v1/categorias ----------------
app.get('/v1/categorias', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400').json(CATEGORIAS);
});

// ---------------- 2. GET /v1/ocorrencias/semelhantes ----------------
app.get('/v1/ocorrencias/semelhantes', (req, res) => {
  const { categoria, lat, lng } = req.query;
  if (!categoria || !CATEGORIAS_VALIDAS.has(categoria)) {
    return responderErro(res, 400, 'CATEGORIA_INVALIDA', 'Categoria inválida.');
  }

  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || numLat < -90 || numLat > 90 || isNaN(numLng) || numLng < -180 || numLng > 180) {
    return responderErro(res, 400, 'LOCALIZACAO_INVALIDA', 'Coordenadas lat e lng inválidas.');
  }

  const candidatas = procurarSemelhantes(categoria, { lat: numLat, lng: numLng }, []);
  const top5 = candidatas.slice(0, 5).map(c => ({
    ocorrencia: formatarOcorrencia(c.ocorrencia),
    distancia: c.distancia
  }));

  res.set('Cache-Control', 'no-store').json({ candidatas: top5 });
});

// ---------------- 3. GET /v1/ocorrencias?bbox= ----------------
app.get('/v1/ocorrencias', (req, res) => {
  const bbox = req.query.bbox;
  if (!bbox || typeof bbox !== 'string') {
    return responderErro(res, 400, 'BBOX_OBRIGATORIO', 'Parâmetro bbox obrigatório (minLng,minLat,maxLng,maxLat).');
  }

  const partes = bbox.split(',').map(s => Number(s.trim()));
  if (partes.length !== 4 || partes.some(isNaN)) {
    return responderErro(res, 400, 'BBOX_INVALIDO', 'Parâmetro bbox deve conter quatro valores numéricos separados por vírgula.');
  }

  const [minLng, minLat, maxLng, maxLat] = partes;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90 || minLng > maxLng || minLat > maxLat) {
    return responderErro(res, 400, 'BBOX_LIMITES_INVALIDOS', 'Limites do bbox inválidos ou ordem incorreta.');
  }

  const resultado = [];
  for (const o of ocorrencias.values()) {
    if (o.estado === 'resolvida') continue;
    const { lat, lng } = o.localizacao;
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      resultado.push(formatarOcorrencia(o));
    }
  }

  res.set('Cache-Control', 'no-store').json(resultado);
});

// ---------------- 4. POST /v1/ocorrencias (Criar ou Reforçar) ----------------
app.post('/v1/ocorrencias', exigirCidadao, (req, res) => {
  // Simulação de erro 503
  if (simular503Contador > 0) {
    simular503Contador--;
    res.set('Retry-After', '2');
    return responderErro(res, 503, 'SERVICO_INDISPONIVEL', 'Serviço temporariamente indisponível (simulação).');
  }

  // Idempotency-Key
  const chaveIdempotencia = req.get('Idempotency-Key');
  let mapaChave = null;
  if (chaveIdempotencia !== undefined) {
    if (!isUUID(chaveIdempotencia)) {
      return responderErro(res, 400, 'CHAVE_INVALIDA', 'Idempotency-Key deve ser um UUID válido.');
    }
    mapaChave = `${req.cidadaoId}:${chaveIdempotencia.toLowerCase()}`;
    if (chavesIdempotencia.has(mapaChave)) {
      const entrada = chavesIdempotencia.get(mapaChave);
      const corpoAtual = JSON.stringify(req.body ?? {});
      if (corpoAtual === entrada.corpoReq) {
        return res.status(entrada.status)
          .set('Location', entrada.location)
          .set('Idempotent-Replayed', 'true')
          .set('Cache-Control', 'no-store')
          .json(entrada.body);
      } else {
        return responderErro(res, 409, 'CONFLITO_IDEMPOTENCIA', 'Chave de idempotência já utilizada com corpo diferente.');
      }
    }
  }

  const { categoria, descricao, localizacao, fotografia, recusadas } = req.body ?? {};

  // Validação dos dados
  if (!categoria || !CATEGORIAS_VALIDAS.has(categoria)) {
    return responderErro(res, 400, 'CATEGORIA_INVALIDA', 'Categoria inválida.');
  }
  if (typeof descricao !== 'string' || descricao.trim().length < 10 || descricao.trim().length > 500) {
    return responderErro(res, 400, 'DESCRICAO_INVALIDA', 'Descrição deve ter entre 10 e 500 caracteres.');
  }
  if (!localizacao || typeof localizacao !== 'object') {
    return responderErro(res, 400, 'LOCALIZACAO_INVALIDA', 'Localização obrigatória.');
  }

  const lat = Number(localizacao.lat);
  const lng = Number(localizacao.lng !== undefined ? localizacao.lng : localizacao.lon);
  const precisao = Number(localizacao.precisao ?? 0);
  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180 || isNaN(precisao) || precisao < 0) {
    return responderErro(res, 400, 'LOCALIZACAO_INVALIDA', 'Coordenadas ou precisão inválidas.');
  }

  let bufferFoto = null;
  if (fotografia !== undefined && fotografia !== null && fotografia !== '') {
    if (typeof fotografia !== 'string' || !fotografia.startsWith('data:image/jpeg;base64,')) {
      return responderErro(res, 400, 'FOTOGRAFIA_INVALIDA', 'A fotografia deve ser uma URL de dados JPEG (data:image/jpeg;base64,...).');
    }
    const base64Data = fotografia.slice('data:image/jpeg;base64,'.length);
    bufferFoto = Buffer.from(base64Data, 'base64');
    if (bufferFoto.length > 300 * 1024) {
      return responderErro(res, 400, 'FOTOGRAFIA_GRANDE', 'Fotografia excede o limite máximo de 300 KB.');
    }
  }

  if (recusadas !== undefined && !Array.isArray(recusadas)) {
    return responderErro(res, 400, 'RECUSADAS_INVALIDAS', 'O campo recusadas deve ser uma lista de identificadores.');
  }

  // Deteção de duplicados síncrona (sem await entre a procura e a escrita)
  const locNormalizada = { lat, lng, precisao };
  const semelhantes = procurarSemelhantes(categoria, locNormalizada, recusadas);

  let statusResposta;
  let corpoResposta;
  let locationUrl;

  if (semelhantes.length === 0) {
    // 1. Nenhuma semelhante -> Criar nova ocorrência
    const novoId = crypto.randomUUID();
    const agora = new Date().toISOString();
    const nova = {
      id: novoId,
      categoria,
      descricao: descricao.trim(),
      localizacao: locNormalizada,
      temFotografia: Boolean(bufferFoto),
      estado: 'aberta',
      comunicacoes: 1,
      criadaEm: agora,
      atualizadaEm: agora,
      versao: ++contadorVersao,
      cidadaos: [req.cidadaoId]
    };

    ocorrencias.set(String(novoId), nova);
    if (bufferFoto) {
      fotografias.set(String(novoId), bufferFoto);
    }
    salvarDados();

    statusResposta = 201;
    locationUrl = `/v1/ocorrencias/${novoId}`;
    corpoResposta = {
      resultado: 'criada',
      ocorrencia: formatarOcorrencia(nova)
    };
  } else {
    // 2. Semelhante encontrada -> Reforçar ou Ja-comunicada
    const semelhante = semelhantes[0].ocorrencia;
    locationUrl = `/v1/ocorrencias/${semelhante.id}`;

    if (semelhante.cidadaos.includes(req.cidadaoId)) {
      // Mesmo cidadão a repetir
      statusResposta = 200;
      corpoResposta = {
        resultado: 'ja-comunicada',
        ocorrencia: formatarOcorrencia(semelhante)
      };
    } else {
      // Outro cidadão -> Reforçar ocorrência
      semelhante.cidadaos.push(req.cidadaoId);
      semelhante.comunicacoes++;
      semelhante.versao = ++contadorVersao;
      semelhante.atualizadaEm = new Date().toISOString();
      salvarDados();

      statusResposta = 200;
      corpoResposta = {
        resultado: 'reforcada',
        ocorrencia: formatarOcorrencia(semelhante)
      };
    }
  }

  // Registo de idempotência
  if (mapaChave) {
    chavesIdempotencia.set(mapaChave, {
      corpoReq: JSON.stringify(req.body ?? {}),
      status: statusResposta,
      location: locationUrl,
      body: corpoResposta,
      timestamp: Date.now()
    });

    if (SIMULAR_PERDA_RESPOSTA && !chavesPerdidasSimuladas.has(mapaChave)) {
      chavesPerdidasSimuladas.add(mapaChave);
      req.socket.destroy();
      return;
    }
  }

  res.status(statusResposta)
    .set('Location', locationUrl)
    .set('Cache-Control', 'no-store')
    .json(corpoResposta);
});

// ---------------- 5. POST /v1/ocorrencias/:id/reforcos (Reforço Direto) ----------------
app.post('/v1/ocorrencias/:id/reforcos', exigirCidadao, (req, res) => {
  if (simular503Contador > 0) {
    simular503Contador--;
    res.set('Retry-After', '2');
    return responderErro(res, 503, 'SERVICO_INDISPONIVEL', 'Serviço temporariamente indisponível (simulação).');
  }

  const chaveIdempotencia = req.get('Idempotency-Key');
  let mapaChave = null;
  if (chaveIdempotencia !== undefined) {
    if (!isUUID(chaveIdempotencia)) {
      return responderErro(res, 400, 'CHAVE_INVALIDA', 'Idempotency-Key deve ser um UUID válido.');
    }
    mapaChave = `${req.cidadaoId}:${chaveIdempotencia.toLowerCase()}`;
    if (chavesIdempotencia.has(mapaChave)) {
      const entrada = chavesIdempotencia.get(mapaChave);
      const corpoAtual = JSON.stringify(req.body ?? {});
      if (corpoAtual === entrada.corpoReq) {
        return res.status(entrada.status)
          .set('Location', entrada.location)
          .set('Idempotent-Replayed', 'true')
          .set('Cache-Control', 'no-store')
          .json(entrada.body);
      } else {
        return responderErro(res, 409, 'CONFLITO_IDEMPOTENCIA', 'Chave de idempotência já utilizada com corpo diferente.');
      }
    }
  }

  const id = String(req.params.id);
  const ocorrencia = ocorrencias.get(id);
  if (!ocorrencia) {
    return responderErro(res, 404, 'RECURSO_INEXISTENTE', 'Ocorrência inexistente.');
  }

  if (ocorrencia.estado === 'resolvida') {
    return responderErro(res, 410, 'OCORRENCIA_RESOLVIDA', 'Esta ocorrência já se encontra resolvida.');
  }

  let statusResposta;
  let corpoResposta;
  const locationUrl = `/v1/ocorrencias/${ocorrencia.id}`;

  if (ocorrencia.cidadaos.includes(req.cidadaoId)) {
    statusResposta = 200;
    corpoResposta = {
      resultado: 'ja-comunicada',
      ocorrencia: formatarOcorrencia(ocorrencia)
    };
  } else {
    ocorrencia.cidadaos.push(req.cidadaoId);
    ocorrencia.comunicacoes++;
    ocorrencia.versao = ++contadorVersao;
    ocorrencia.atualizadaEm = new Date().toISOString();
    salvarDados();

    statusResposta = 201;
    corpoResposta = {
      resultado: 'reforcada',
      ocorrencia: formatarOcorrencia(ocorrencia)
    };
  }

  if (mapaChave) {
    chavesIdempotencia.set(mapaChave, {
      corpoReq: JSON.stringify(req.body ?? {}),
      status: statusResposta,
      location: locationUrl,
      body: corpoResposta,
      timestamp: Date.now()
    });

    if (SIMULAR_PERDA_RESPOSTA && !chavesPerdidasSimuladas.has(mapaChave)) {
      chavesPerdidasSimuladas.add(mapaChave);
      req.socket.destroy();
      return;
    }
  }

  res.status(statusResposta)
    .set('Location', locationUrl)
    .set('Cache-Control', 'no-store')
    .json(corpoResposta);
});

// ---------------- 6. GET /v1/ocorrencias/:id/fotografia ----------------
app.get('/v1/ocorrencias/:id/fotografia', (req, res) => {
  const id = String(req.params.id);
  const ocorrencia = ocorrencias.get(id);
  if (!ocorrencia || !ocorrencia.temFotografia || !fotografias.has(id)) {
    return responderErro(res, 404, 'FOTOGRAFIA_NAO_ENCONTRADA', 'Fotografia não encontrada.');
  }

  const buffer = fotografias.get(id);
  res.status(200)
    .set('Content-Type', 'image/jpeg')
    .set('Cache-Control', 'no-store')
    .send(buffer);
});

// ---------------- 7. GET /v1/ocorrencias/alteracoes?desde= ----------------
app.get('/v1/ocorrencias/alteracoes', exigirCidadao, (req, res) => {
  const desdeStr = req.query.desde;
  if (desdeStr === undefined || desdeStr === null || desdeStr.trim() === '' || !/^\d+$/.test(String(desdeStr).trim())) {
    return responderErro(res, 400, 'PARAMETRO_INVALIDO', 'Parâmetro desde obrigatório e deve ser inteiro >= 0.');
  }

  const desde = parseInt(String(desdeStr).trim(), 10);
  const alteracoes = [];

  for (const o of ocorrencias.values()) {
    if (o.cidadaos.includes(req.cidadaoId) && o.versao > desde) {
      alteracoes.push(o);
    }
  }

  alteracoes.sort((a, b) => a.versao - b.versao);
  const cursor = alteracoes.length > 0 ? Math.max(...alteracoes.map(o => o.versao)) : desde;

  res.status(200)
    .set('Cache-Control', 'private, no-store')
    .json({
      alteracoes: alteracoes.map(formatarOcorrencia),
      cursor
    });
});

// ---------------- 8. PATCH /v1/admin/ocorrencias/:id (Administração) ----------------
app.patch('/v1/admin/ocorrencias/:id', (req, res) => {
  const adminToken = req.get('X-Admin-Token');
  if (!adminToken || adminToken !== ADMIN_TOKEN) {
    return responderErro(res, 403, 'TOKEN_INVALIDO', 'Token de administração inválido.');
  }

  const id = String(req.params.id);
  const ocorrencia = ocorrencias.get(id);
  if (!ocorrencia) {
    return responderErro(res, 404, 'RECURSO_INEXISTENTE', 'Ocorrência inexistente.');
  }

  const { estado } = req.body ?? {};
  if (!['aberta', 'em-resolucao', 'resolvida'].includes(estado)) {
    return responderErro(res, 400, 'ESTADO_INVALIDO', 'Estado deve ser aberta, em-resolucao ou resolvida.');
  }

  ocorrencia.estado = estado;
  ocorrencia.versao = ++contadorVersao;
  ocorrencia.atualizadaEm = new Date().toISOString();
  salvarDados();

  res.status(200)
    .set('Cache-Control', 'no-store')
    .json(formatarOcorrencia(ocorrencia));
});

// Ficheiros estáticos do cliente PWA
app.use(express.static(path.join(__dirname, 'public')));

// Erros 404 e tratamento de JSON malformatado
app.use((req, res) => responderErro(res, 404, 'NAO_ENCONTRADO', 'Rota inexistente.'));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.parse.failed' ? 400 : 500;
  responderErro(res, status, status === 400 ? 'JSON_MALFORMATADO' : 'ERRO_INTERNO', status === 400 ? 'Corpo JSON malformado.' : 'Erro interno do servidor.');
});

if (require.main === module) {
  app.listen(porta, () => {
    console.log(`Reporta v2 pronto: http://localhost:${porta}`);
  });
}

module.exports = app;
