import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const destino = new URL('./.env', import.meta.url);
if (existsSync(destino)) console.log('.env existente preservado.');
else { writeFileSync(destino, `PORTA=3000\nJWT_SEGREDO=${randomBytes(48).toString('hex')}\nJWT_VALIDADE=900\nSIMULAR_PERDA_RESPOSTA=0\nSIMULAR_503=0\n`); console.log('.env criado com segredo aleatório.'); }
