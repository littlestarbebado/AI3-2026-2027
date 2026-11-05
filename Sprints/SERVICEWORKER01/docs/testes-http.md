# Ensaios HTTP executados

05/11/2026. Pedidos reais feitos com curl -i; segredos e cookies não registados.

- PASSOU: T1: GET categorias público, 200, public max-age=86400, cinco categorias
- PASSOU: Login: 200, cookie HttpOnly, SameSite=Strict, Path=/v2, no-store
- PASSOU: T2: título com cinco caracteres devolve 400 com detalhes
- PASSOU: T3: 201, Location, no-store e identidade obtida do token
- PASSOU: Ana recebe apenas sugestões próprias
- PASSOU: Sem cookie: 401
- PASSOU: Logout: 204 e cookie expirado
- PASSOU: Cookie copiado continua válido depois de logout (limite JWT)
- PASSOU: Serviços não podem criar: 403
