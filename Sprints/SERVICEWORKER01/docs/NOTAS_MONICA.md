# Monica — guia da parte

bd.js abre sugestoes-bd versão 1 com sugestoes, pendentes e meta. As operações devolvem Promise concluída no evento complete. substituirSugestoes faz clear+put+atualizadoEm numa única transação; confirmarPendente faz delete+put na mesma transação. Os índices porData e porEstado aplicam a ordenação. guardarProprietario limpa dados de outro utilizador atomicamente. O parâmetro utilizador protege escritas de respostas antigas. Revisão: CA3 e armazenamento de CA4.

Ver também LEIA-ME.md, registo.md e docs/GUIAO_TESTES.md, incluídos na parte do Dinis.
