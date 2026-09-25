## 8. Tabela de nós de fatura-v2.xml

| Nó | Tipo | Pai | Irmãos | Justificação |
|---|---|---|---|---|
| fatura | Raiz | — | — | Contém todos os outros elementos. Não tem elemento pai nem elementos irmãos. |
| produtos | Intermédio | fatura | cabecalho | Contém elementos produto e tem o mesmo pai que cabecalho. |
| nome | Terminal | cliente | morada, telefone | Contém texto e não tem elementos filhos. |
| id | Atributo | fatura (elemento a que pertence) | — | Identifica a fatura. Não é irmão dos elementos filhos de fatura. |
| João Silva | Texto | nome | — | É o texto dentro de nome e o seu único nó filho. |