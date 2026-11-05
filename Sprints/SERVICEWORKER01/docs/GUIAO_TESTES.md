# Demonstração no computador do grupo

1. Extrair os quatro ZIPs para a raiz do mesmo repositório e executar os comandos do LEIA-ME.
2. Abrir localhost:3000 e F12. Rede: ligar Preservar registo. Aplicação: ver Cookies, Service Workers, Cache Storage e IndexedDB.
3. Entrar como Ana. Confirmar cookie HttpOnly, sessão após recarregar e caches interface-v1/dados-publicos sem /v2/sessao ou /v2/sugestoes.
4. Escrever um rascunho, recarregar e verificar recuperação. Mudar ordenação e tema.
5. Ativar Offline, recarregar: ver sem-ligacao, nome, hora da cópia e logout desativado. Criar uma sugestão válida. Ver registo em pendentes.
6. Desativar Offline: verificar GET sessão e POST 201 com remoção da pendente. A lista deve ser lida da IndexedDB.
7. Parar servidor, definir JWT_VALIDADE=30, arrancar e entrar novamente. Criar pendente offline, esperar expiração e voltar online: pendente preservada. Entrar como a mesma pessoa para enviar. Repetir e entrar como Bruno para testar limpeza por mudança de proprietário.
8. Criar pendente offline, voltar online sem deixar enviar automaticamente (ou criar um registo com erro para a demonstração). Ao terminar sessão, verificar dialog com contagem; Cancelar preserva; confirmar só apaga depois de DELETE 204.
9. Alterar interface-v1 para interface-v2 em sw.js. Recarregar online, clicar Atualizar a aplicação e verificar eliminação da cache v1. Guardar as alterações de versão com o grupo.
10. Limitar rede a 3G lento e recarregar para observar a-verificar. Retirar a limitação no fim.

Para o curl no PowerShell, usar curl.exe. Não colocar cookies, segredos ou palavras-passe reais no Git. Contas fictícias no ficheiro privado entregue à parte.
