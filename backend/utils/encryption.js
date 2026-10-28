const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_SOURCE = process.env.ENCRYPTION_SECRET || 'OmnixGlobalSophiaSecretKey2026!!';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(String(SECRET_SOURCE))
  .digest('base64')
  .substring(0, 32);

function encryptApiKey(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

module.exports = { encryptApiKey };