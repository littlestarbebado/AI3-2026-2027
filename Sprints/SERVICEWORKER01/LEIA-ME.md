# API04 — Daniel, Mónica, Bia e Dinis

## Onde extrair os quatro ZIPs

Abrir cada ZIP e copiar o conteúdo para a mesma raiz do repositório:

`D:\GitHub\AI3-2026-2027\`

Os ZIPs já trazem o caminho `Sprints/OPENAPI04/`. Escolher a raiz acima como destino, não a pasta OPENAPI04 nem servidor. Ao juntar as pastas Sprints, aceitar combinar pastas. Os quatro pacotes têm ficheiros de código diferentes.

Resultado final: `D:\GitHub\AI3-2026-2027\Sprints\OPENAPI04\servidor\servidor.js` e `...\servidor\public\app.js`.

## Divisão

| Pessoa | Responsabilidade | Ficheiros |
|---|---|---|
| Daniel | Interface, estados, sessão, rascunho, configurações e integração do cliente | public/index.html, estilos.css, app.js, configuracoes.js |
| Mónica | IndexedDB, índices, transações e separação por proprietário | public/bd.js |
| Bia | Cache offline, atualização da aplicação e envio das pendentes | public/sw.js, pendentes.js |
| Dinis | Contrato de base, servidor, dados, configuração, integração e registo | restantes ficheiros |

Os caminhos public/ acima estão dentro de servidor/. Juntar os quatro pacotes antes de executar. Cada membro deve perceber e rever a sua parte.

## Arrancar no Windows / PowerShell

```powershell
cd 'D:\GitHub\AI3-2026-2027\Sprints\OPENAPI04\servidor'
npm.cmd install
node preparar-env.mjs
npm.cmd start
```

Abrir http://localhost:3000. Não abrir por Live Server nem por duplo clique em index.html. O comando usa npm.cmd para evitar o bloqueio de npm.ps1. É necessário Node 20.6 ou superior.

O preparar-env.mjs cria um .env com segredo aleatório apenas se este ainda não existir. As contas fictícias estão no ficheiro privado entregue com o ZIP do Dinis, fora de Sprints. Não colocar palavras-passe nem .env no Git.

Para testar expiração: parar com Ctrl+C, alterar JWT_VALIDADE para 30 no .env, voltar a arrancar e entrar de novo. Para demonstrar atualização: alterar interface-v1 para interface-v2 em public/sw.js, guardar e recarregar online; clicar em Atualizar a aplicação quando disponível. Repor offline só depois de a interface e as categorias terem sido guardadas numa visita online.

## Contrato API03: incompatibilidade encontrada

A ficha exige manter o contrato API03. A versão atual do grupo no GitHub, porém, não tem /categorias e usa NovaSugestao/texto e docente, ao contrário dos requisitos titulo/descricao/categoria e aluno/servicos da sequência das fichas. Não é possível cumprir os dois formatos ao mesmo tempo.

Por isso este pacote inclui uma **correção explícita do pré-requisito API03**, construída sobre o contrato API02 completo e mantendo 2.1.0. A implementação API04 usa essa base corrigida. O original do grupo foi preservado sem alterações em docs/contrato-api03-original.yaml, para comparação. Não afirmar que o contrato entregue é idêntico ao original do GitHub: rever esta correção com o docente antes da entrega.

A API04 não introduz endpoints para sincronização nem chaves de idempotência; usa os endpoints da base corrigida. As criações no servidor ficam em memória e perdem-se quando o processo reinicia, como na API03.

## Verificação

Os resultados executados estão em docs/testes-http.md e docs/testes-browser.md. O registo distingue ensaios reais e observações ainda a demonstrar presencialmente. O contrato passou no Redocly sem erros; os avisos estão documentados.

## Limites

Um POST cuja resposta se perde pode ter sido executado; o reenvio pode duplicar uma sugestão. A base desta ficha não resolve esse caso. O token não é revogado no servidor ao apagar o cookie. IndexedDB guarda dados locais sem cifra; a aplicação restringe a apresentação e limpa dados na troca de proprietário/logout, mas não protege contra inspeção local ou código malicioso na origem. A fila é protegida contra chamadas simultâneas na mesma página; coordenação entre várias páginas remetentes não está implementada. Não há Background Sync, bibliotecas no cliente, notificações push ou manifesto.
