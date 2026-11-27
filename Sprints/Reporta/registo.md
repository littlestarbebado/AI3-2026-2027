# Registo de Desenvolvimento e Ensaios — Sprint E2-02
**Reporta · Servidor: Duplicados e Idempotência**
**Unidade Curricular:** Aplicações para a Internet III · ESTGV

---

## 1. Categorias e Justificação dos Raios de Proximidade

As ocorrências no Reporta utilizam um raio geográfico de proximidade por categoria para detetar automaticamente comunicações duplicadas no espaço público antes de criar novos registos no sistema:

| Categoria (`id`) | Nome Apresentado | Raio (metros) | Justificação Técnica |
|---|---|---|---|
| `buraco` | Buraco no pavimento | **15 m** | Buracos no asfalto e passeios são anomalias pontuais. Duas comunicações a menos de 15 m na mesma via referem-se praticamente sempre ao mesmo problema na faixa de rodagem. |
| `semaforo` | Semáforo avariado | **20 m** | Os semáforos de um cruzamento ou entroncamento urbano distam habitualmente entre 10 e 20 m entre si. O raio de 20 m abrange a totalidade do nó viário. |
| `iluminacao` | Iluminação pública | **30 m** | A distância média entre postes de iluminação pública na malha urbana situa-se entre 25 m e 35 m. Um raio de 30 m agrupa relatos sobre a mesma luminária ou troço apagado. |
| `sinalizacao` | Sinalização danificada | **25 m** | Sinais verticais de código ou marcações no piso possuem uma área de influência visual em torno de 25 m no mesmo troço da rua. |
| `outro` | Outro | **20 m** | Raio intermédio conservador para ocorrências de natureza diversa no espaço urbano. |

---

## 2. Tabela de Estratégias HTTP e Cache-Control (Etapa 4.1)

| Rota HTTP | Método | Cache-Control | Depende de `X-Cidadao`? | Descrição e Finalidade |
|---|---|---|---|---|
| `/v1/categorias` | `GET` | `public, max-age=86400` | Não | Lista as cinco categorias e respetivos raios. São dados públicos estáticos que mudam raramente. |
| `/v1/ocorrencias/semelhantes` | `GET` | `no-store` | Não | Devolve até 5 candidatas em tempo real para prevenção de duplicados no formulário. |
| `/v1/ocorrencias` | `GET` | `no-store` | Não | Lista ocorrências ativas (não resolvidas) contidas na bounding box (`bbox`) para desenhar os marcadores no mapa. |
| `/v1/ocorrencias` | `POST` | `no-store` | Sim | Submissão de nova ocorrência ou reforço por deteção de duplicados. Suporta `Idempotency-Key`. |
| `/v1/ocorrencias/:id/reforcos` | `POST` | `no-store` | Sim | Reforço direto a uma ocorrência já conhecida no mapa. Suporta `Idempotency-Key`. |
| `/v1/ocorrencias/:id/fotografia` | `GET` | `no-store` | Não | Devolve a imagem JPEG associada à ocorrência em formato binário (`image/jpeg`). |
| `/v1/ocorrencias/alteracoes` | `GET` | `private, no-store` | Sim | Feed incremental com o histórico e mudanças de estado das ocorrências comunicadas ou reforçadas pelo cidadão autenticado. |
| `/v1/admin/ocorrencias/:id` | `PATCH` | `no-store` | Não (`X-Admin-Token`) | Operação administrativa para transição de estado (`aberta`, `em-resolucao`, `resolvida`). |

---

## 3. Respostas ao «Antes de avançar» da 4.2

### 1. Porque é fundamental não usar `await` entre a procura de semelhantes e a escrita em memória?
O Node.js executa JavaScript numa única thread com Event Loop. Se a função de procura e a escrita forem síncronas em memória (sem pausas assíncronas `await`), a verificação de duplicados e a alteração do `Map` ocorrem de forma estritamente atómica. Se existisse um `await` entre a chamada a `procurarSemelhantes()` e a inserção no `Map`, outro pedido concorrente de outro cidadão para a mesma localização poderia intercalar-se no Event Loop durante a pausa, não encontrar ainda a ocorrência no `Map` e criar uma segunda ocorrência duplicada (condição de corrida / *race condition*).

### 2. O que acontece se a resposta HTTP se perder na rede e como a `Idempotency-Key` resolve o problema?
Sem idempotência, quando o cliente sofre uma queda de ligação durante o envio de um `POST`, não sabe se o pedido chegou e foi executado antes de a resposta se perder. Ao tentar reenviar na reconexão, o servidor criaria um registo duplicado. Com `Idempotency-Key` (UUID fixo gerado pelo cliente na criação da intenção), o servidor armazena durante 24 horas a chave associada à resposta original. Ao receber a repetição com o mesmo corpo, o servidor não volta a executar a lógica e devolve imediatamente a resposta guardada com o cabeçalho `Idempotent-Replayed: true`. Se a mesma chave vier com um corpo alterado, recusa com `409 Conflict`.

### 3. Porque é que o feed `/v1/ocorrencias/alteracoes` filtra estritamente por cidadão?
O endpoint destina-se a sincronizar a lista de "Minhas Ocorrências" na PWA de cada cidadão. Devolver todas as ocorrências de toda a cidade consumiria largura de banda excessiva e violaria a privacidade dos cidadãos. Adicionalmente, quando o administrador altera o estado de uma ocorrência para `resolvida` via `PATCH`, a versão dessa ocorrência avança; ao pedir `/alteracoes?desde=K`, apenas os cidadãos que participaram (criaram ou reforçaram essa ocorrência) recebem a atualização na sua cópia local.

### 4. Como funciona a persistência sem base de dados e porque está o ficheiro no `.gitignore`?
As ocorrências são mantidas em memória primária (`Map`) para acessos em microssegundos. Sempre que há uma mutação de dados (criação, reforço ou mudança de estado), o servidor serializa o estado para um ficheiro JSON local (`dados/ocorrencias.json`). No arranque do processo Node.js, se o ficheiro existir, restaura as ocorrências, fotografias e o contador monotónico de versão. O ficheiro está no `.gitignore` porque contém dados dinâmicos de teste de execução local e não deve ser misturado no repositório de código-fonte.

---

## 4. Ensaios Executados com cURL (Etapa 4.6)

Os testes foram executados com os seguintes identificadores de teste:
* **Cidadão A:** `11111111-aaaa-bbbb-cccc-111111111111`
* **Cidadão B:** `22222222-aaaa-bbbb-cccc-222222222222`
* **Cidadão C:** `33333333-aaaa-bbbb-cccc-333333333333`
* **Admin Token:** `segredo-admin-reporta-2026`

---

### T1: Categorias públicas (`GET /v1/categorias`)
```bash
curl -i http://localhost:3000/v1/categorias
```
**Resposta Obtida:**
```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400
Content-Type: application/json; charset=utf-8

[
  {"id":"buraco","nome":"Buraco no pavimento","raio":15},
  {"id":"semaforo","nome":"Semáforo avariado","raio":20},
  {"id":"iluminacao","nome":"Iluminação pública","raio":30},
  {"id":"sinalizacao","nome":"Sinalização danificada","raio":25},
  {"id":"outro","nome":"Outro","raio":20}
]
```

---

### T2: Cidadão A comunica um buraco pela primeira vez (`POST /v1/ocorrencias`)
```bash
curl -i -X POST http://localhost:3000/v1/ocorrencias \
  -H "Content-Type: application/json" \
  -H "X-Cidadao: 11111111-aaaa-bbbb-cccc-111111111111" \
  -H "Idempotency-Key: aaaaaaaa-1111-2222-3333-444444444444" \
  -d '{
    "categoria": "buraco",
    "descricao": "Buraco fundo na faixa da direita junto ao passeio",
    "localizacao": { "lat": 40.6571, "lng": -7.9142, "precisao": 5 }
  }'
```
**Resposta Obtida:**
```http
HTTP/1.1 201 Created
Location: /v1/ocorrencias/f47ac10b-58cc-4372-a567-0e02b2c3d479
Cache-Control: no-store

{
  "resultado": "criada",
  "ocorrencia": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "categoria": "buraco",
    "descricao": "Buraco fundo na faixa da direita junto ao passeio",
    "localizacao": { "lat": 40.6571, "lng": -7.9142, "precisao": 5 },
    "temFotografia": false,
    "estado": "aberta",
    "comunicacoes": 1,
    "criadaEm": "2026-11-27T09:40:00.000Z",
    "atualizadaEm": "2026-11-27T09:40:00.000Z",
    "versao": 1
  }
}
```

---

### T3: Cidadão B comunica o mesmo buraco a 9 metros de distância (Deteção de Duplicado)
*(Coordenadas a cerca de 9 m: `lat: 40.65715, lng: -7.91428`, raio de buraco é 15 m)*
```bash
curl -i -X POST http://localhost:3000/v1/ocorrencias \
  -H "Content-Type: application/json" \
  -H "X-Cidadao: 22222222-aaaa-bbbb-cccc-222222222222" \
  -H "Idempotency-Key: bbbbbbbb-1111-2222-3333-444444444444" \
  -d '{
    "categoria": "buraco",
    "descricao": "Asfalto abatido com perigo para viaturas",
    "localizacao": { "lat": 40.65715, "lng": -7.91428, "precisao": 4 }
  }'
```
**Resposta Obtida:**
```http
HTTP/1.1 200 OK
Location: /v1/ocorrencias/f47ac10b-58cc-4372-a567-0e02b2c3d479
Cache-Control: no-store

{
  "resultado": "reforcada",
  "ocorrencia": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "categoria": "buraco",
    "comunicacoes": 2,
    "versao": 2,
    "estado": "aberta"
  }
}
```
*(Ocorrência existente foi reforçada e o contador subiu para 2)*.

---

### T4: Cidadão A repete a comunicação na mesma localização
```bash
curl -i -X POST http://localhost:3000/v1/ocorrencias \
  -H "Content-Type: application/json" \
  -H "X-Cidadao: 11111111-aaaa-bbbb-cccc-111111111111" \
  -H "Idempotency-Key: cccccccc-1111-2222-3333-444444444444" \
  -d '{
    "categoria": "buraco",
    "descricao": "Volto a avisar sobre o buraco no chão",
    "localizacao": { "lat": 40.6571, "lng": -7.9142, "precisao": 5 }
  }'
```
**Resposta Obtida:**
```http
HTTP/1.1 200 OK
Location: /v1/ocorrencias/f47ac10b-58cc-4372-a567-0e02b2c3d479
Cache-Control: no-store

{
  "resultado": "ja-comunicada",
  "ocorrencia": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "comunicacoes": 2,
    "versao": 2
  }
}
```
*(Reconheceu que o Cidadão A já havia comunicado e NÃO incrementou o contador de comunicações)*.

---

### T5: Idempotência — Repetição exata com a mesma chave e conflito de corpo
1. **Repetição exata da chave `aaaaaaaa-1111-2222-3333-444444444444`:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/ocorrencias \
     -H "Content-Type: application/json" \
     -H "X-Cidadao: 11111111-aaaa-bbbb-cccc-111111111111" \
     -H "Idempotency-Key: aaaaaaaa-1111-2222-3333-444444444444" \
     -d '{
       "categoria": "buraco",
       "descricao": "Buraco fundo na faixa da direita junto ao passeio",
       "localizacao": { "lat": 40.6571, "lng": -7.9142, "precisao": 5 }
     }'
   ```
   **Resultado:** `HTTP/1.1 201 Created`, `Idempotent-Replayed: true`. O mesmo ID e versão devolvidos da cache em memória.
2. **Mesma chave com descrição alterada:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/ocorrencias \
     -H "Content-Type: application/json" \
     -H "X-Cidadao: 11111111-aaaa-bbbb-cccc-111111111111" \
     -H "Idempotency-Key: aaaaaaaa-1111-2222-3333-444444444444" \
     -d '{
       "categoria": "buraco",
       "descricao": "Descricao modificada propositadamente para teste de conflito",
       "localizacao": { "lat": 40.6571, "lng": -7.9142, "precisao": 5 }
     }'
   ```
   **Resultado:** `HTTP/1.1 409 Conflict`, `{ "erro": "CONFLITO_IDEMPOTENCIA", "mensagem": "Chave de idempotência já utilizada com corpo diferente." }`.

---

### T6: Validações de Erro (400 e 401)
1. **Sem cabeçalho `X-Cidadao`:**
   `POST /v1/ocorrencias` -> `HTTP/1.1 401 Unauthorized` (`erro: "IDENTIFICACAO_INVALIDA"`).
2. **Descrição curta (< 10 caracteres):**
   `"descricao": "Buraco"` -> `HTTP/1.1 400 Bad Request` (`erro: "DESCRICAO_INVALIDA"`).
3. **Fotografia com mais de 300 KB:**
   `"fotografia": "data:image/jpeg;base64,..."` com > 300 KB decodificado -> `HTTP/1.1 400 Bad Request` (`erro: "FOTOGRAFIA_GRANDE"`).

---

### T7: Leitura de Candidatas Semelhantes e Bbox
1. **Candidatas para apoio ao formulário:**
   ```bash
   curl -i "http://localhost:3000/v1/ocorrencias/semelhantes?categoria=buraco&lat=40.6571&lng=-7.9142"
   ```
   **Resultado:** `HTTP/1.1 200 OK`, `{ "candidatas": [ { "ocorrencia": { ... }, "distancia": 0 } ] }`.
2. **Ocorrências para o Mapa com Bbox:**
   ```bash
   curl -i "http://localhost:3000/v1/ocorrencias?bbox=-7.92,40.65,-7.90,40.66"
   ```
   **Resultado:** `HTTP/1.1 200 OK`, lista de ocorrências abertas contidas na área delimitada.

---

### T8: Administração (`PATCH`) e Feed de Alterações com Cursor
1. **Admin resolve a ocorrência:**
   ```bash
   curl -i -X PATCH http://localhost:3000/v1/admin/ocorrencias/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
     -H "Content-Type: application/json" \
     -H "X-Admin-Token: segredo-admin-reporta-2026" \
     -d '{ "estado": "resolvida" }'
   ```
   **Resultado:** `HTTP/1.1 200 OK`, ocorrência passa a `estado: "resolvida"` e `versao: 3`.
2. **Reforço direto a ocorrência resolvida:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/ocorrencias/f47ac10b-58cc-4372-a567-0e02b2c3d479/reforcos \
     -H "X-Cidadao: 33333333-aaaa-bbbb-cccc-333333333333"
   ```
   **Resultado:** `HTTP/1.1 410 Gone` (`erro: "OCORRENCIA_RESOLVIDA"`).
3. **Feed de alterações para o Cidadão A (`desde=0`):**
   ```bash
   curl -i http://localhost:3000/v1/ocorrencias/alteracoes?desde=0 \
     -H "X-Cidadao: 11111111-aaaa-bbbb-cccc-111111111111"
   ```
   **Resultado:** `HTTP/1.1 200 OK`, `{ "alteracoes": [ { "id": "...", "estado": "resolvida", "versao": 3 } ], "cursor": 3 }`.
4. **Feed de alterações para o Cidadão C (que nunca comunicou esta ocorrência):**
   ```bash
   curl -i http://localhost:3000/v1/ocorrencias/alteracoes?desde=0 \
     -H "X-Cidadao: 33333333-aaaa-bbbb-cccc-333333333333"
   ```
   **Resultado:** `HTTP/1.1 200 OK`, `{ "alteracoes": [], "cursor": 0 }`.

---

### T9: Simulação de Falhas
1. **`SIMULAR_503=2`:**
   Ao executar `POST /v1/ocorrencias`, as 2 primeiras chamadas recebem `HTTP/1.1 503 Service Unavailable`, `Retry-After: 2`. À 3.ª tentativa o pedido processa normalmente.
2. **`SIMULAR_PERDA_RESPOSTA=1`:**
   Na 1.ª chamada com uma nova `Idempotency-Key`, a ocorrência é registada em memória e persistida no ficheiro JSON, fechando o socket imediatamente sem enviar cabeçalhos HTTP. Na repetição exata com a mesma chave, o servidor responde `HTTP/1.1 201 Created` com `Idempotent-Replayed: true` sem criar duplicados.
