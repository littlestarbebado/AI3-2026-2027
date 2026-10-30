# Registo de Verificação e Demonstração · API03
**Unidade Curricular:** Aplicações para a Internet III · ESTGV  
**Tema:** Guardar dados no browser com localStorage e sessionStorage e transportar o token de autenticação num cookie.  
**Versão do Contrato OpenAPI:** 2.1.0  

---

## 1. Verificação do Servidor com `curl` (Ponto 16 · Testes T1 a T8)

Todos os testes foram executados com `curl -i` contra o servidor em `http://localhost:3000`.

### T1 · POST /v2/sessao com credenciais válidas da Ana
**Comando:**
```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"utilizador":"ana","palavraPasse":"segredo123"}' http://localhost:3000/v2/sessao
```
**Resultado obtido:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Set-Cookie: sessao=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=900; Path=/v2; Expires=Fri, 23 Oct 2026 09:06:24 GMT; HttpOnly; SameSite=Strict
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
Content-Length: 96

{"utilizador":"ana","nome":"Ana Marques","papel":"aluno","expiracao":"2026-10-23T09:06:24.813Z"}
```
*Análise:* O servidor respondeu com `200 OK`, emitiu o cabeçalho `Set-Cookie` com o token JWT e todos os atributos de segurança exigidos (`HttpOnly`, `SameSite=Strict`, `Path=/v2`, `Max-Age=900`), e incluiu `Cache-Control: no-store`.

---

### T2 · POST /v2/sessao com palavra-passe errada
**Comando:**
```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"utilizador":"ana","palavraPasse":"errada"}' http://localhost:3000/v2/sessao
```
**Resultado obtido:**
```http
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
Content-Length: 32

{"erro":"Credenciais invalidas"}
```
*Análise:* O servidor devolveu `401 Unauthorized` e **nenhum cabeçalho `Set-Cookie` foi emitido**.

---

### T3 · GET /v2/sessao com o cookie da Ana
**Comando:**
```bash
curl -i -b cookies.txt http://localhost:3000/v2/sessao
```
**Resultado obtido:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
Content-Length: 96

{"utilizador":"ana","nome":"Ana Marques","papel":"aluno","expiracao":"2026-10-23T09:06:24.000Z"}
```
*Análise:* O cookie enviado no cabeçalho foi lido pela função `lerCookie(req, 'sessao')` e validado pelo middleware `exigirToken`. O servidor devolveu `200 OK` com os dados do utilizador autenticado.

---

### T4 · GET /v2/sugestoes com o cookie da Ana
**Comando:**
```bash
curl -i -b cookies.txt http://localhost:3000/v2/sugestoes
```
**Resultado obtido:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 293

[{"id":1,"numeroAluno":"28377","texto":"Disponibilizar mais tomadas para portateis na sala de estudo.","data":"2026-10-21T10:00:00.000Z","estado":"submetida"},{"id":2,"numeroAluno":"28377","texto":"Melhorar a conexao Wi-Fi no bloco B.","data":"2026-10-22T14:30:00.000Z","estado":"em_analise"}]
```
*Análise:* O servidor filtrou as sugestões e devolveu apenas as que pertencem ao número de aluna da Ana (`28377`), ocultando as dos restantes alunos.

---

### T5 · GET /v2/sugestoes sem cookie
**Comando:**
```bash
curl -i http://localhost:3000/v2/sugestoes
```
**Resultado obtido:**
```http
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
Content-Length: 55

{"erro":"Autenticacao necessaria: token nao fornecido"}
```
*Análise:* Na ausência de token tanto no cabeçalho `Authorization` como no cookie `sessao`, o pedido foi imediatamente barrado com `401 Unauthorized`.

---

### T6 · POST /v2/sugestoes com o cookie da Ana
**Comando:**
```bash
curl -i -b cookies.txt -H "Content-Type: application/json" -d '{"texto":"Alargar o horario da biblioteca em epoca de exames."}' http://localhost:3000/v2/sugestoes
```
**Resultado obtido:**
```http
HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 147

{"id":4,"numeroAluno":"28377","texto":"Alargar o horario da biblioteca em epoca de exames.","data":"2026-10-23T08:53:21.211Z","estado":"submetida"}
```
*Análise:* A sugestão foi criada com sucesso com o `id: 4`, associada ao `numeroAluno` contido no token JWT, e respondida com `201 Created`.

---

### T7 · DELETE /v2/sessao (Terminar Sessão)
**Comando:**
```bash
curl -i -b cookies.txt -c cookies.txt -X DELETE http://localhost:3000/v2/sessao
```
**Resultado obtido:**
```http
HTTP/1.1 204 No Content
X-Powered-By: Express
Set-Cookie: sessao=; Path=/v2; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Cache-Control: no-store
```
*Análise:* O servidor respondeu com `204 No Content` e emitiu um cabeçalho `Set-Cookie` com data no passado (`Expires=Thu, 01 Jan 1970 00:00:00 GMT`), instruindo o cliente a eliminar imediatamente o cookie de sessão do armazenamento local.

---

### T8 · GET /v2/sugestoes com o valor do cookie copiado antes de T7
**Comando:**
```bash
curl -i -b cookies_copiado.txt http://localhost:3000/v2/sugestoes
```
**Resultado obtido:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 441

[{"id":1,"numeroAluno":"28377",...},{"id":2,"numeroAluno":"28377",...},{"id":4,"numeroAluno":"28377",...}]
```
**Explicação do comportamento em T8:**  
O servidor **aceitou o pedido e devolveu `200 OK`**.  
*Porquê?* A autenticação por JSON Web Token (JWT) é **stateless** (sem estado no servidor). O servidor não guarda uma lista de sessões ativas nem revogações em base de dados; limita-se a verificar matematicamente a assinatura criptográfica e a data de validade (`exp`) contidas no token.  
Ao chamar `DELETE /v2/sessao`, a remoção do cookie acontece apenas no cliente. Se alguém tiver copiado a string do token antes de a sessão ser terminada, o token continua criptograficamente válido no servidor até que decorram os 15 minutos do seu tempo de vida.

---

## 2. Verificação no Browser (Ponto 17 · Alíneas a a f)

Com a aplicação aberta em `http://localhost:3000` e as Ferramentas de Programador ativas (*DevTools*):

* **(a) Cookie `sessao` na lista de cookies:**  
  No separador **Application (Aplicação) -> Storage -> Cookies -> `http://localhost:3000`**, visualiza-se o cookie com:
  * Nome: `sessao`
  * Path: `/v2`
  * Max-Age/Expires: 15 minutos após a criação
  * HttpOnly: com a marcação `true` (ativo)
  * SameSite: `Strict`

* **(b) Resultado de escrever `document.cookie` na consola:**  
  Retorna uma string vazia `""`.  
  *Justificação:* O atributo `HttpOnly` impede propositadamente que qualquer código JavaScript em execução na página consiga aceder ao conteúdo do cookie, neutralizando vetores de roubo de sessão via XSS (Cross-Site Scripting).

* **(c) Manutenção da sessão após recarregar a página (F5):**  
  Ao recarregar a página, a função `verificarSessao()` faz um pedido `GET /v2/sessao`. Como o browser anexa o cookie automaticamente, o servidor responde `200 OK` com os dados da Ana. A página apresenta logo a área de sessão ativa sem pedir novo login.

* **(d) Manutenção das configurações após fechar e reabrir o browser:**  
  O mecanismo `localStorage` tem persistência persistente que sobrevive ao fecho do browser. Ao reabrir a página, o tema selecionado (ex.: "escuro") e a ordenação mantêm-se exatamente iguais.

* **(e) Alteração manual para `{"tema":"roxo"}` no localStorage:**  
  Ao executar na consola `localStorage.setItem('configuracoes', '{"tema":"roxo"}')` e recarregar a página:  
  A função `lerConfiguracoes()` valida o valor lido contra a lista de valores permitidos (`['claro', 'escuro']`). Como `"roxo"` é inválido, ativa o mecanismo defensivo de contingência e repõe o valor por omissão (`"claro"`), garantindo que a aplicação não quebra nem apresenta estilos corrompidos.

* **(f) Rascunho em `sessionStorage`:**  
  Enquanto o aluno digita no formulário de sugestão, o texto é gravado continuamente na chave `rascunhoSugestao` do `sessionStorage`.  
  * Ao fazer refresh (F5), o texto reaparece preenchido no campo.  
  * Ao abrir a mesma aplicação noutro separador, o campo surge vazio, provando que o `sessionStorage` é isolado e exclusivo daquele separador.

---

## 3. Comparação dos Mecanismos no Browser (Ponto 18)

| Dado | Mecanismo usado | Quanto tempo dura | Porque não se usou outro mecanismo |
| :--- | :--- | :--- | :--- |
| **Token de autenticação** | `cookie` (`HttpOnly`, `SameSite=Strict`, `Path=/v2`, `Max-Age=900`) | 15 minutos (900 s) ou até «Terminar sessão» | É enviado automaticamente pelo browser em cada pedido HTTP sem código JavaScript manual. Com `HttpOnly`, fica completamente inacessível a scripts da página, protegendo contra roubo por ataques de XSS (ao contrário de `localStorage`/`sessionStorage` que estão expostos ao JavaScript). |
| **Configurações da interface** (tema e ordenação) | `localStorage` | Até ser limpo pelo utilizador ou aplicação | As preferências do utilizador devem perdurar além da sessão atual e ser partilhadas por todos os separadores do browser. Não devem ser transmitidas em cada pedido ao servidor (o que gastaria tráfego desnecessário num cookie) e não devem desaparecer ao fechar o separador (como aconteceria com `sessionStorage`). |
| **Rascunho da sugestão** | `sessionStorage` | Até o separador em que foi escrito ser fechado | O rascunho de uma sugestão é temporário e específico do contexto de trabalho daquele separador. Não deve ser partilhado com outros separadores nem persistir eternamente (evitando confusões em `localStorage`). Também não faz sentido enviar dados incompletos ao servidor em cada pedido HTTP (o que aconteceria num cookie). |

---

## 4. Reflexão Crítica (Ponto 19)

### 1. Que vantagem tem o cookie em relação à variável usada na API02? E que desvantagem?
* **Vantagens:**  
  1. **Persistência ao recarregar:** Quando a página é recarregada (F5), o token não se perde, pois o browser preserva o cookie e envia-o automaticamente em cada pedido subsequente.  
  2. **Segurança acrescida (XSS):** Com o atributo `HttpOnly`, o token deixa de estar exposto ao JavaScript da página, impedindo que scripts maliciosos injetados (XSS) capturem a sessão.  
  3. **Simplificação do cliente:** O cliente não precisa de guardar tokens em memória nem de adicionar manualmente o cabeçalho `Authorization: Bearer <token>` em cada `fetch()`.
* **Desvantagens:**  
  1. O cliente deixa de conseguir ler o payload do token (obrigando à criação de um endpoint como `GET /v2/sessao` para saber quem está autenticado).  
  2. Suscetibilidade potencial a ataques de CSRF (Cross-Site Request Forgery), o que exige a configuração rigorosa de `SameSite=Strict` e restrição de `Path`.

### 2. Em T8, o servidor aceitou o cookie depois de terminada a sessão? Porquê?
* **Resposta:** Sim, o servidor aceitou o pedido (`200 OK`).  
* **Justificação:** O JWT é um mecanismo de autenticação **stateless** (sem estado). O servidor não guarda uma tabela de sessões ativas; apenas valida a assinatura matemática e o tempo de expiração (`exp`) contidos no próprio token.  
O endpoint de logout (`DELETE /v2/sessao`) apenas envia uma instrução HTTP ao browser para expirar e apagar o cookie (`Max-Age=0`). Se um atacante (ou utilizador) tiver copiado o token antes do logout, esse token continuará válido aos olhos do servidor até que o seu prazo natural de 15 minutos expire. Para invalidar imediatamente tokens do lado do servidor seria necessário implementar uma lista de revogação (*blacklist*) em base de dados/memória.

### 3. Se a Ana mudar de computador, as suas configurações acompanham-na? O que seria necessário para que isso acontecesse?
* **Resposta:** Não acompanham. O `localStorage` fica armazenado exclusivamente no disco rígido e no perfil do browser daquele computador específico.  
* **O que seria necessário:** Para que as configurações acompanhassem a utilizadora em qualquer dispositivo, elas teriam de ser tratadas como dados de negócio: guardadas no servidor numa base de dados associada à conta da Ana, acompanhadas de rotas na API (ex.: `GET /v2/configuracoes` e `PUT /v2/configuracoes`) para carregar e atualizar as preferências no momento do login.

---

## 5. Apoio ao Guião de Avaliação Oral

### CA1 · Contrato
* **Onde está declarado o cookie no contrato?**  
  Em `components.securitySchemes.cookieSessao` com `type: apiKey`, `in: cookie` e `name: sessao`, e incluído na lista de `security` global da raiz.
* **Que diferença faz colocar `tokenJWT` e `cookieSessao` em dois elementos da lista `security` ou no mesmo elemento?**  
  Colocar em dois elementos separados (`- tokenJWT: []` e `- cookieSessao: []`) representa uma relação lógica de **OU** (disjunção): o pedido é aceite se fornecer o token no cabeçalho OU no cookie. Se estivessem juntos dentro do mesmo elemento da lista, representariam um **E** (conjunção), exigindo ambos em simultâneo.
* **Por que razão a versão passa a 2.1.0 e não a 3.0.0? Um cliente da API02 continua a funcionar?**  
  Segundo o Versionamento Semântico (SemVer), incrementa-se o número menor (MINOR: 2.0.0 -> 2.1.0) quando se introduzem novas funcionalidades mantendo a retrocompatibilidade. Um cliente antigo da API02 continua a funcionar perfeitamente porque a operação `POST /v2/tokens` foi preservada e o middleware `exigirToken` continua a aceitar o cabeçalho `Authorization: Bearer`.

### CA2 · Cookie de Sessão
* **O JavaScript do cliente consegue ler o token? Então como sabe o nome do utilizador?**  
  Não consegue ler o token devido ao atributo `HttpOnly`. O cliente descobre a identidade do utilizador fazendo um pedido `GET /v2/sessao`, no qual o servidor lê o cookie, descodifica o payload e devolve um JSON com o nome, papel e data de expiração.
* **Por que razão a sessão se mantém depois de recarregar a página, ao contrário da API02?**  
  Na API02 o token residia numa variável JavaScript que é destruída quando a página descarrega. Com cookies, os dados residem no armazenamento persistente de cookies gerido pelo browser, que os reenvia automaticamente a cada novo pedido HTTP.

### CA3 · Configurações em `localStorage`
* **Por que razão as configurações ficam em `localStorage` e não em `sessionStorage`?**  
  Porque as configurações de tema e ordenação devem ser duradouras (persistir entre dias e utilizações) e estar partilhadas em todos os separadores da aplicação.
* **As configurações pertencem ao utilizador ou ao browser? Se a Ana e o Bruno usarem o mesmo computador, partilham-nas?**  
  Pertencem ao **browser**. Se a Ana e o Bruno partilharem a mesma conta de utilizador do sistema operativo e o mesmo browser, irão partilhar as mesmas configurações guardadas no `localStorage`.

### CA4 · Rascunho em `sessionStorage`
* **Por que razão o rascunho fica em `sessionStorage` e não em `localStorage`?**  
  Porque um rascunho é temporário e específico do contexto de trabalho daquele separador em particular. Se estivesse em `localStorage`, caso o utilizador abrisse dois separadores para redigir duas sugestões diferentes, um separador iria sobrescrever o rascunho do outro.
* **Por que razão o rascunho é apagado quando a sessão termina?**  
  Por motivos de privacidade e consistência: quando um utilizador faz logout, outro utilizador pode entrar a seguir e não deve ver o texto inacabado da pessoa anterior.
