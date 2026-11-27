# Validação da preparação — 20/11/2026

Verificações executadas em Linux, Node 24.22.3:
- npm install: concluído; única dependência direta express.
- Contrato validado com openapi-spec-validator: sem erros; oito operações e quatro esquemas.
- Arranque com node --env-file=.env.exemplo servidor.js: concluído. No PC copiar primeiro para .env, conforme LEIA-ME.
- Oito operações HTTP reais: todas 501 com erro e mensagem.
- Rota inexistente: 404 com corpo de erro.
- Página e recursos estáticos: HTTP 200.
- Manifesto JSON: válido; standalone; ícones PNG reais 192x192 e 512x512.
- Sintaxe de todos os ficheiros JavaScript: node --check sem erros.

Não executado: Swagger Editor visual, Chrome DevTools, instalação da PWA, verificação visual do registo SW. Confirmar no PC e acrescentar evidências ao registo. Não foram testadas funcionalidades de sprints posteriores.

Os ZIPs não incluem .env nem node_modules. package-lock.json conserva as versões resolvidas.
