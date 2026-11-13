<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sugestões dos Alunos — ESTGV</title>
  <link rel="stylesheet" href="/estilos.css">
</head>
<body data-estado="a-verificar">

  <header class="cabecalho">
    <div class="container-cabecalho">
      <h1>Portal de Sugestões dos Alunos</h1>
      <div id="indicadorLigacao" class="indicador-ligacao" aria-live="polite">A verificar ligação…</div>
    </div>
  </header>

  <!-- Notificações e Banners globais -->
  <aside id="zonaNotificacao" class="zona-notificacao" aria-live="polite" hidden></aside>
  
  <div id="bannerAtualizacao" class="banner-atualizacao" hidden>
    <span>Há uma versão nova da aplicação disponível.</span>
    <button id="btnAtualizarApp" type="button">Atualizar a aplicação</button>
  </div>

  <main class="container principal">

    <!-- 1. Estado: A verificar sessão -->
    <section id="areaVerificar" class="painel area-estado">
      <div class="spinner"></div>
      <p>A verificar sessão ativa…</p>
    </section>

    <!-- 2. Estado: Sem sessão (Formulário de Entrada) -->
    <section id="areaSemSessao" class="painel area-estado" hidden>
      <h2>Iniciar Sessão</h2>
      <p class="instrucao">Aceda com o seu número de estudante (ex: 12345) ou conta institucional.</p>
      
      <form id="formLogin" novalidate>
        <div id="erroLogin" class="mensagem-erro" hidden></div>

        <div class="campo">
          <label for="campoUtilizador">Número de Aluno / Utilizador:</label>
          <input type="text" id="campoUtilizador" name="utilizador" required placeholder="Ex: 12345" autocomplete="username">
        </div>

        <div class="campo">
          <label for="campoPalavraPasse">Palavra-passe:</label>
          <input type="password" id="campoPalavraPasse" name="palavraPasse" required autocomplete="current-password">
        </div>

        <button type="submit" id="btnEntrar" class="btn btn-primario">Entrar</button>
      </form>
    </section>

    <!-- 3. Estado: Sem ligação ao carregar -->
    <section id="areaSemLigacao" class="painel area-estado" hidden>
      <h2>Aplicação Sem Ligação</h2>
      <p id="msgSemLigacao">Não foi possível contactar o servidor para validar a sessão.</p>
      <button id="btnTentarNovamente" type="button" class="btn btn-secundario">Tentar ligar novamente</button>
    </section>

    <!-- 4. Estado: Com sessão ativa -->
    <section id="areaComSessao" class="painel area-estado" hidden>
      <div class="sessao-topo">
        <div>
          <h2 id="tituloBoasVindas" tabindex="-1">Bem-vindo(a)</h2>
          <p class="sessao-expira">Sessão expira em: <strong id="contadorSessao">--:--</strong></p>
        </div>
        <div class="acoes-sessao">
          <button id="btnTerminarSessao" type="button" class="btn btn-perigo">Terminar sessão</button>
        </div>
      </div>

      <!-- Configurações Locais -->
      <div class="barra-ferramentas">
        <label for="selectOrdenacao">Ordenar lista por:</label>
        <select id="selectOrdenacao">
          <option value="data_desc">Data (mais recentes primeiro)</option>
          <option value="data_asc">Data (mais antigas primeiro)</option>
          <option value="estado">Estado</option>
        </select>
        <button id="btnSincronizarManual" type="button" class="btn btn-pequeno">Sincronizar agora</button>
      </div>

      <!-- Formulário de Nova Sugestão -->
      <section class="caixa-formulario">
        <h3>Submeter Nova Sugestão</h3>
        <p class="dica">Pode submeter mesmo sem ligação! A sugestão ficará na fila offline e será sincronizada automaticamente.</p>
        
        <form id="formSugestao">
          <div id="erroSugestao" class="mensagem-erro" hidden></div>

          <div class="campo">
            <label for="campoTitulo">Título da sugestão (5 a 100 caracteres):</label>
            <input type="text" id="campoTitulo" name="titulo" required minlength="5" maxlength="100" placeholder="Resumo claro da sugestão">
          </div>

          <div class="campo">
            <label for="campoCategoria">Categoria:</label>
            <select id="campoCategoria" name="categoria" required>
              <option value="">A carregar categorias…</option>
            </select>
          </div>

          <div class="campo">
            <label for="campoDescricao">Descrição detalhada (10 a 1000 caracteres):</label>
            <textarea id="campoDescricao" name="descricao" rows="4" required minlength="10" maxlength="1000" placeholder="Explique a situação e a proposta de melhoria"></textarea>
          </div>

          <button type="submit" id="btnSubmeterSugestao" class="btn btn-sucesso">Submeter Sugestão</button>
        </form>
      </section>

      <!-- Lista de Sugestões -->
      <section class="seccao-lista">
        <h3>As Minhas Sugestões</h3>
        <div id="listaSugestoes" class="lista-cartoes">
          <p class="aviso-vazio">Nenhuma sugestão encontrada.</p>
        </div>
      </section>
    </section>

  </main>

  <!-- Diálogo de confirmação de Logout com pendentes -->
  <dialog id="dialogConfirmarLogout" class="dialogo">
    <h3>Atenção: Sugestões Pendentes</h3>
    <p id="msgConfirmarLogout">Existem sugestões por enviar. Se terminar a sessão agora, essas sugestões locais serão apagadas.</p>
    <div class="dialogo-acoes">
      <button id="btnCancelarLogout" type="button" class="btn btn-secundario">Cancelar</button>
      <button id="btnConfirmarLogout" type="button" class="btn btn-perigo">Terminar Sessão</button>
    </div>
  </dialog>

  <!-- Scripts modulares -->
  <script src="/configuracoes.js"></script>
  <script src="/bd.js"></script>
  <script src="/pendentes.js"></script>
  <script src="/app.js"></script>
</body>
</html>
