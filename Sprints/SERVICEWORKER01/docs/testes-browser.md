# Testes automáticos no Chromium

05/11/2026. Playwright em Chromium headless, viewport 360 × 800.

- PASSOU: Arranque sem cookie: sem-sessao
- PASSOU: Login e listagem online em 360 px
- PASSOU: Cookie HttpOnly não legível pela página
- PASSOU: Recarregamento conserva sessão
- PASSOU: Caches só contêm interface e categorias, sem dados privados
- PASSOU: Rascunho sobrevive ao recarregamento
- PASSOU: Recarregamento offline mostra cópia local e desativa logout
- PASSOU: Criação offline guarda pendente em IndexedDB
- PASSOU: Ordenação offline consulta o índice local
- PASSOU: Reconexão envia pendente e confirma criação
- PASSOU: Logout limpa as três lojas e coloca foco no utilizador
- PASSOU: Bruno não recebe cópia nem pendentes da Ana
- PASSOU: Sem overflow horizontal em 360 px
- PASSOU: Sem exceções JavaScript na página

Exceções: []

## Casos adicionais

Validade real de oito segundos para acelerar o ensaio (a ficha propõe 30).

- PASSOU: Expiração real mantém pendente, cópia e rascunho
- PASSOU: Reconexão com sessão expirada não envia pendente
- PASSOU: Bruno entra após expiração: dados e rascunho da Ana são apagados
- PASSOU: Reentrada com a mesma pessoa envia as pendentes preservadas
- PASSOU: Atualização v1 → v2 por botão ativa nova versão e apaga cache antiga

## Fila e diálogo

- PASSOU: Pendente com 400 fica marcada e a seguinte é enviada
- PASSOU: Cancelar diálogo de logout preserva sessão e pendente
- PASSOU: Confirmar diálogo faz DELETE e só depois limpa pendentes
