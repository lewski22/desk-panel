/**
 * Szyfrowanie hasła SMTP — AES-256-GCM
 * Klucz: env SMTP_ENCRYPTION_KEY (32 bajty hex, 64 znaki)
 *
 * Generowanie klucza: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.SMTP_ENCRYPTION_KEY ?? '';
  if (!raw || raw.length !== 64) {
    throw new Error('SMTP_ENCRYPTION_KEY musi mieć 64 znaki hex (32 bajty). ' +
      'Wygeneruj: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(raw, 'hex');
}

export function encryptSmtpPassword(plaintext: string): string {
  const key = getKey();
  const iv  = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  // Format: iv(12B) + tag(16B) + ciphertext — base64
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSmtpPassword(encoded: string): string {
  const key  = getKey();
  const data = Buffer.from(encoded, 'base64');
  const iv   = data.subarray(0, 12);
  const tag  = data.subarray(12, 28);
  const enc  = data.subarray(28);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}
