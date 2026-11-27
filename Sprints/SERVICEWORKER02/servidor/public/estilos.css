/* estilos.css — Folha de Estilos (API05 - SERVICEWORKER02) */

:root {
  --cor-fundo: #f4f7f9;
  --cor-primaria: #2563eb;
  --cor-primaria-hover: #1d4ed8;
  --cor-perigo: #dc2626;
  --cor-perigo-hover: #b91c1c;
  --cor-sucesso: #16a34a;
  --cor-sucesso-hover: #15803d;
  --cor-aviso: #d97706;
  --cor-texto: #1e293b;
  --cor-texto-secundario: #64748b;
  --cor-borda: #e2e8f0;
  --raio-borda: 8px;
  --sombra: 0 2px 10px rgba(0,0,0,0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--cor-fundo);
  color: var(--cor-texto);
  min-height: 100vh;
}

/* Cabeçalho */
.cabecalho {
  background: var(--cor-primaria);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.container-cabecalho {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.container-cabecalho h1 { font-size: 1.3rem; }

.indicador-ligacao {
  font-size: 0.85rem;
  opacity: 0.9;
  padding: 0.3rem 0.7rem;
  background: rgba(255,255,255,0.15);
  border-radius: 20px;
}

/* Banner de atualização */
.banner-atualizacao {
  background: #0f172a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.8rem 1.5rem;
  font-size: 0.9rem;
}

/* Notificações */
.zona-notificacao {
  max-width: 900px;
  margin: 1rem auto 0;
  padding: 0 1.5rem;
}
.zona-notificacao:not([hidden]) {
  display: block;
}
.mensagem-notificacao {
  padding: 0.75rem 1rem;
  border-radius: var(--raio-borda);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.mensagem-notificacao.sucesso { background: #dcfce7; border-left: 4px solid var(--cor-sucesso); color: #14532d; }
.mensagem-notificacao.aviso  { background: #fef9c3; border-left: 4px solid var(--cor-aviso); color: #713f12; }
.mensagem-notificacao.erro   { background: #fee2e2; border-left: 4px solid var(--cor-perigo); color: #7f1d1d; }

/* Container principal */
.principal {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

/* Painéis (estados) */
.painel {
  background: white;
  border-radius: var(--raio-borda);
  padding: 2rem;
  box-shadow: var(--sombra);
}
.area-estado[hidden] { display: none; }
.area-estado:not([hidden]) { display: block; }

/* Estado a-verificar */
#areaVerificar { text-align: center; padding: 3rem; }
.spinner {
  width: 40px; height: 40px;
  border: 4px solid var(--cor-borda);
  border-top-color: var(--cor-primaria);
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
  margin: 0 auto 1rem;
}
@keyframes girar { to { transform: rotate(360deg); } }

/* Formulários */
.campo { margin-bottom: 1.2rem; }
.campo label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--cor-texto);
}
.campo input, .campo select, .campo textarea {
  width: 100%;
  padding: 0.65rem 0.9rem;
  border: 1.5px solid var(--cor-borda);
  border-radius: var(--raio-borda);
  font-size: 1rem;
  font-family: inherit;
  color: var(--cor-texto);
  background: white;
  transition: border-color 0.2s;
}
.campo input:focus, .campo select:focus, .campo textarea:focus {
  outline: none;
  border-color: var(--cor-primaria);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
}
.campo textarea { resize: vertical; }

/* Botões */
.btn {
  padding: 0.65rem 1.4rem;
  border-radius: var(--raio-borda);
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.2s, opacity 0.2s;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primario  { background: var(--cor-primaria); color: white; }
.btn-primario:hover:not(:disabled) { background: var(--cor-primaria-hover); }
.btn-perigo    { background: var(--cor-perigo); color: white; }
.btn-perigo:hover:not(:disabled) { background: var(--cor-perigo-hover); }
.btn-sucesso   { background: var(--cor-sucesso); color: white; }
.btn-sucesso:hover:not(:disabled) { background: var(--cor-sucesso-hover); }
.btn-secundario { background: #e2e8f0; color: var(--cor-texto); }
.btn-secundario:hover:not(:disabled) { background: #cbd5e1; }
.btn-pequeno   { padding: 0.4rem 0.9rem; font-size: 0.85rem; background: #e2e8f0; color: var(--cor-texto); }
.btn-pequeno:hover { background: #cbd5e1; }

/* Mensagens de erro inline */
.mensagem-erro {
  background: #fee2e2;
  color: #7f1d1d;
  border: 1px solid #fca5a5;
  border-radius: var(--raio-borda);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.mensagem-erro:not([hidden]) { display: block; }

/* Área de sessão ativa */
.sessao-topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.sessao-expira { font-size: 0.85rem; color: var(--cor-texto-secundario); margin-top: 0.3rem; }

/* Barra de ferramentas */
.barra-ferramentas {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

/* Formulário de nova sugestão */
.caixa-formulario {
  background: #f8fafc;
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio-borda);
  padding: 1.5rem;
  margin-bottom: 2rem;
}
.caixa-formulario h3 { margin-bottom: 0.5rem; }
.instrucao, .dica {
  font-size: 0.85rem;
  color: var(--cor-texto-secundario);
  margin-bottom: 1rem;
}

/* Lista de sugestões (Cartões) */
.seccao-lista h3 { margin-bottom: 1rem; }
.lista-cartoes { display: flex; flex-direction: column; gap: 0.75rem; }
.aviso-vazio { color: var(--cor-texto-secundario); font-style: italic; }

.cartao-sugestao {
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio-borda);
  padding: 1rem 1.2rem;
  background: white;
}
.cartao-sugestao .linha-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.cartao-sugestao .titulo { font-weight: 600; }
.cartao-sugestao .descricao { font-size: 0.9rem; color: var(--cor-texto-secundario); margin-top: 0.3rem; }

.etiqueta {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.etiqueta-submetida   { background: #dbeafe; color: #1d4ed8; }
.etiqueta-em_analise  { background: #fef9c3; color: #92400e; }
.etiqueta-aceite      { background: #dcfce7; color: #15803d; }
.etiqueta-rejeitada   { background: #fee2e2; color: #b91c1c; }
.etiqueta-resolvida   { background: #f3f4f6; color: #374151; }
.etiqueta-por-enviar  { background: #e0e7ff; color: #3730a3; }
.etiqueta-erro        { background: #fee2e2; color: #b91c1c; }

.cartao-sugestao .info-extra {
  font-size: 0.8rem;
  color: var(--cor-texto-secundario);
  margin-top: 0.4rem;
}

/* Diálogos nativos */
.dialogo {
  border: none;
  border-radius: var(--raio-borda);
  padding: 2rem;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.dialogo h3 { margin-bottom: 0.75rem; }
.dialogo p  { font-size: 0.95rem; color: var(--cor-texto-secundario); margin-bottom: 1.5rem; }
.dialogo-acoes { display: flex; gap: 0.75rem; justify-content: flex-end; }
dialog::backdrop { background: rgba(0,0,0,0.5); }

/* Responsividade */
@media (max-width: 600px) {
  .sessao-topo, .barra-ferramentas { flex-direction: column; align-items: flex-start; }
  .container-cabecalho { flex-direction: column; align-items: flex-start; }
}
