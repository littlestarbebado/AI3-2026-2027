import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const destino = new URL('./.env', import.meta.url);
if (existsSync(destino)) console.log('O .env já existe; foi preservado.');
else { writeFileSync(destino, `JWT_SEGREDO=${randomBytes(48).toString('hex')}\nJWT_VALIDADE=900\nPORT=3000\n`); console.log('.env criado com segredo aleatório local.'); }
