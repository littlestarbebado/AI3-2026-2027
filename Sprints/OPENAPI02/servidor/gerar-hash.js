import bcrypt from 'bcryptjs';
const palavraPasse = process.argv[2];
if (!palavraPasse || palavraPasse.length < 8 || palavraPasse.length > 128) {
  console.error('Uso: node gerar-hash.js <palavra-passe de 8 a 128 caracteres>');
  process.exit(1);
}
console.log(await bcrypt.hash(palavraPasse, 10));
