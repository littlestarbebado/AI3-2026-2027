
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
export function exigirToken(segredo) {
  return (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') ?? '');
    const falhar = invalido => res.set('Cache-Control', 'no-store').set('WWW-Authenticate', invalido ? 'Bearer error="invalid_token"' : 'Bearer').status(401).json({ codigo: 401, mensagem: 'Autenticação necessária.' });
    if (!match) return falhar(false);
    try {
      const p = jwt.verify(match[1], segredo, { algorithms: ['HS256'] });
      if (typeof p.sub !== 'string' || typeof p.nome !== 'string' || !['aluno', 'servicos'].includes(p.papel) || !Number.isFinite(p.iat) || !Number.isFinite(p.exp)) return falhar(true);
      req.utilizador = { sub: p.sub, nome: p.nome, papel: p.papel };
      next();
    } catch { return falhar(true); }
  };
}
export function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!papeis.includes(req.utilizador?.papel)) return res.set('Cache-Control', 'no-store').status(403).json({ codigo: 403, mensagem: 'Sem permissão para esta operação.' });
    next();
  };
}

export function criarHandlerToken({ segredo, validade, utilizadores }) {
  const hashFicticio = utilizadores[0].hashPalavraPasse;
  return async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { utilizador, palavraPasse } = req.body ?? {};
    const detalhes = [];
    if (typeof utilizador !== 'string' || !/^(\d{5,8}|[a-z]+\.[a-z]+)$/.test(utilizador)) detalhes.push({ campo: 'utilizador', problema: 'Use 5 a 8 algarismos ou nome.apelido em minúsculas sem acentos.' });
    if (typeof palavraPasse !== 'string' || palavraPasse.length < 8 || palavraPasse.length > 128) detalhes.push({ campo: 'palavraPasse', problema: 'São necessários 8 a 128 caracteres.' });
    if (detalhes.length) return res.status(400).json({ codigo: 400, mensagem: 'Dados inválidos.', detalhes });
    const pessoa = utilizadores.find(p => p.utilizador === utilizador);
    const correta = await bcrypt.compare(palavraPasse, pessoa?.hashPalavraPasse ?? hashFicticio);
    if (!pessoa || !correta) return res.status(401).json({ codigo: 401, mensagem: 'Credenciais inválidas.' });
    const token = jwt.sign({ nome: pessoa.nome, papel: pessoa.papel }, segredo, { algorithm: 'HS256', subject: pessoa.utilizador, expiresIn: validade });
    res.json({ token, tipo: 'Bearer', expiraEm: validade });
  } catch (erro) { next(erro); }
  };
}
