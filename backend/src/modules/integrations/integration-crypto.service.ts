/**
 * IntegrationCryptoService — Sprint F0
 *
 * Szyfrowanie/deszyfrowanie konfiguracji integracji (tokeny, secrety, hasła).
 * Algorytm identyczny jak smtp-crypto.ts: AES-256-GCM.
 * Oddzielny klucz: INTEGRATION_ENCRYPTION_KEY (nie dzielimy z SMTP).
 *
 * Generowanie klucza:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * backend/src/modules/integrations/integration-crypto.service.ts
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';

@Injectable()
export class IntegrationCryptoService {
  constructor(private readonly config: ConfigService) {}

  private getKey(): Buffer {
    const raw = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') ?? '';
    if (!raw || raw.length !== 64) {
      throw new Error(
        'INTEGRATION_ENCRYPTION_KEY musi mieć 64 znaki hex (32 bajty). ' +
        'Wygeneruj: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return Buffer.from(raw, 'hex');
  }

  encrypt(plaintext: string): string {
    const key    = this.getKey();
    const iv     = randomBytes(12);
    const cipher = createCipheriv(ALG, key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    // Format: iv(12B) + tag(16B) + ciphertext — base64
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(encoded: string): string {
    const key     = this.getKey();
    const data    = Buffer.from(encoded, 'base64');
    const iv      = data.subarray(0, 12);
    const tag     = data.subarray(12, 28);
    const enc     = data.subarray(28);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final('utf8');
  }

  /** Zwraca null zamiast rzucać — bezpieczne do użycia w read path */
  tryDecrypt(encoded: string | null | undefined): string | null {
    if (!encoded) return null;
    try { return this.decrypt(encoded); } catch { return null; }
  }

  encryptJson(obj: unknown): string {
    return this.encrypt(JSON.stringify(obj));
  }

  decryptJson<T>(encoded: string | null | undefined): T | null {
    const raw = this.tryDecrypt(encoded);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
}
