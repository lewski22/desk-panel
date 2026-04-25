import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN    = 12; // bytes
const TAG_LEN   = 16; // bytes (unused as constant but documents expectation)
void TAG_LEN;

@Injectable()
export class WifiCryptoService implements OnModuleInit {
  private readonly logger = new Logger(WifiCryptoService.name);
  private key: Buffer;

  onModuleInit() {
    const raw = process.env.WIFI_ENCRYPTION_KEY ?? '';
    if (!raw || raw.length < 64) {
      throw new Error(
        'WIFI_ENCRYPTION_KEY env var is missing or too short. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    this.key = Buffer.from(raw.slice(0, 64), 'hex');
    this.logger.log('WifiCryptoService initialized');
  }

  encrypt(plaintext: string): string {
    const iv     = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  decrypt(encrypted: string): string {
    const [ivHex, tagHex, dataHex] = encrypted.split(':');
    const iv      = Buffer.from(ivHex,   'hex');
    const tag     = Buffer.from(tagHex,  'hex');
    const data    = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
