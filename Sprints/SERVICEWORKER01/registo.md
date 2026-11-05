# Registo API04 — Daniel, Mónica, Bia e Dinis

## Base e correções

Ver LEIA-ME.md: a API03 publicada pelo grupo não tem o domínio exigido pela API04. O original está em docs/contrato-api03-original.yaml. O contrato entregue é uma correção do pré-requisito, não uma cópia byte a byte desse original. Foi mantida a versão 2.1.0. Esta divergência tem de ser revista com o docente.

## Estratégias

| Pedido | Cache-Control | Depende do cookie? | Service worker | IndexedDB |
|---|---|---|---|---|
| Interface | — | Não | Cache primeiro | Não |
| GET /v2/categorias | public, max-age=86400 | Não | Cache e atualização em segundo plano | Não |
| POST /v2/sessao | no-store | Não; verifica credenciais e cria cookie | Só rede | Metadados da sessão, nunca token |
| GET /v2/sessao | no-store | Sim | Só rede | Proprietário/expiração |
| DELETE /v2/sessao | no-store | Apaga cookie | Só rede | Limpar todas as lojas após 204 |
| GET /v2/sugestoes | private, no-cache | Sim | Só rede | Loja sugestoes |
| POST /v2/sugestoes | no-store | Sim | Só rede | Pendentes e resultado confirmado |

## Ensaios executados

Os pedidos T1–T3 da API04 foram feitos com curl -i e passaram. O título de cinco caracteres devolveu 400 com detalhes. O numeroAluno falso foi ignorado: a sugestão foi criada com o identificador da Ana, 201, Location e no-store. Resultados adicionais em docs/testes-http.md.

Testes automáticos num Chromium real: arranque, login, cookie HttpOnly, recarregamento, caches sem respostas privadas, rascunho, carregamento offline, pendente, envio na reconexão, ordenação, logout, limpeza das três lojas, isolamento da Ana/Bruno e largura 360 px. Os casos adicionais de expiração e atualização estão em docs/testes-browser.md. Estes ensaios não substituem a explicação oral nem capturas das ferramentas do browser na apresentação.

A verificação no Redocly validou sem erros. Permanecem três avisos: ausência de resposta 4xx documentada em duas operações públicas (categorias e terminarSessao) e um componente Erro404 não utilizado. São avisos de estilo; não foram inventadas respostas adicionais para os silenciar.

Ainda demonstrar no computador do grupo: painel Rede/Aplicação, coluna Tamanho mostrando service worker, limitação 3G para observar a-verificar e os mesmos fluxos com JWT_VALIDADE=30. Registar resultados próprios depois de os executar.

## Armazenamento

| Dado | Mecanismo | Quem escreve | Quando é apagado | Justificação |
|---|---|---|---|---|
| Token | Cookie HttpOnly | Servidor/browser | Logout ou Max-Age | Envio automático, sem leitura pela página |
| Configurações | localStorage | Página | Limpeza do armazenamento pelo utilizador | Preferências persistentes do browser |
| Rascunho | sessionStorage | Página | Sucesso, logout, troca de pessoa ou fecho do separador | Texto temporário por separador |
| Interface | Cache API | Service worker | Ativação de nova versão | Permite abrir offline sem dados pessoais embutidos |
| Categorias | Cache API | Service worker | Limpeza da cache; atualização substitui respostas | Dados públicos iguais para todos |
| Lista | IndexedDB / sugestoes | Página | Logout, mudança de proprietário ou substituição por lista nova | Objetos, índices e transações; dados privados fora da Cache API |
| Pendentes | IndexedDB / pendentes | Página | Confirmação 201, descarte, logout ou troca de pessoa | Sobrevivem ao fecho do browser; erro 400 preservado |

A expiração não apaga os dados privados: impede a sua apresentação e envio até haver sessão válida. A cópia offline é uma conveniência local, não uma autenticação nova. IndexedDB não é um cofre.

## Apoio às reflexões — reescrever por palavras próprias

1. Não é possível iniciar ou confirmar uma sessão no servidor sem ligação; também não é possível pedir ao servidor que apague o cookie HttpOnly. A sessão local anterior só permite apresentar uma cópia ainda dentro da validade registada.
2. A perda de resposta depois de um POST bem-sucedido deixa o cliente sem saber se criou. Ao reenviar pode duplicar. Uma solução exigiria uma chave de idempotência acordada no contrato e deduplicação no servidor. Se fosse opcional e retrocompatível, seria uma versão menor, por exemplo 2.2.0; se obrigatória e quebrasse clientes anteriores, uma versão maior. Essa alteração está excluída desta ficha.
3. Background Sync poderia tentar enviar com a página fechada. Continuaria a precisar de uma sessão válida; com cookie expirado não poderia autenticar nem pedir credenciais por si. Não foi implementado.
4. Depois de expirar, a cópia pode continuar fisicamente em IndexedDB e ser inspecionada num computador partilhado. A interface esconde-a quando expira e apaga-a no logout ou quando muda o proprietário. Acesso físico e ataques na mesma origem continuam por resolver.
5. Configurações e pendentes pertencem ao armazenamento deste browser e origem; não acompanham a pessoa para outro computador. A sincronização das configurações exigiria persistência associada à conta no servidor. As pendentes ainda não enviadas também não existem no servidor.
