import bcrypt from 'bcryptjs';
if (!process.argv[2]) throw new Error('Uso: node gerar-hash.js palavra-passe');
console.log(await bcrypt.hash(process.argv[2], 10));
