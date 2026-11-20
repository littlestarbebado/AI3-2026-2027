'use strict';
const express = require('express');
const path = require('node:path');
const app = express();
const porta = Number(process.env.PORT || 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error('PORT inválida');
function provisoria(req, res) {
  res.set('Cache-Control', 'no-store').status(501).json({
    erro: 'NAO_IMPLEMENTADO', mensagem: 'Operação prevista no contrato; implementação num sprint seguinte.'
  });
}
app.get('/v1/categorias', provisoria);
app.get('/v1/ocorrencias/semelhantes', provisoria);
app.get('/v1/ocorrencias', provisoria);
app.post('/v1/ocorrencias', provisoria);
app.post('/v1/ocorrencias/:id/reforcos', provisoria);
app.get('/v1/ocorrencias/:id/fotografia', provisoria);
app.get('/v1/ocorrencias/alteracoes', provisoria);
app.patch('/v1/admin/ocorrencias/:id', provisoria);
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => res.status(404).json({erro: 'NAO_ENCONTRADO', mensagem: 'Rota inexistente.'}));
app.listen(porta, () => console.log(`Reporta: http://localhost:${porta}`));
