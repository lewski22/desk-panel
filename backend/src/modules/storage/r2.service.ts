/**
 * R2Service — przechowywanie plików w Cloudflare R2 (S3-compatible).
 *
 * Używany do obrazów planów pięter (floor plans). Jeśli R2 nie jest
 * skonfigurowany (brak R2_ACCOUNT_ID / R2_BUCKET_NAME), plany pięter
 * są przechowywane jako base64 bezpośrednio w bazie — tryb awaryjny
 * bez CDN, działający bez dodatkowej infrastruktury.
 *
 * Wymagane env (gdy R2 jest używany):
 *   R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL
 *
 * backend/src/modules/storage/r2.service.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;

  get isConfigured(): boolean { return !!this.client; }

  constructor(private config: ConfigService) {
    const accountId   = config.get<string>('R2_ACCOUNT_ID');
    this.bucket       = config.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicUrl    = config.get<string>('R2_PUBLIC_URL') ?? '';

    if (accountId && this.bucket) {
      this.client = new S3Client({
        region:   'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId:     config.get<string>('R2_ACCESS_KEY_ID') ?? '',
          secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
        },
      });
      this.logger.log(`R2 configured — bucket: ${this.bucket}`);
    } else {
      this.logger.warn('R2 not configured — floor plans will be stored as base64. Set R2_ACCOUNT_ID and R2_BUCKET_NAME to enable CDN.');
    }
  }

  /** Dekoduje data URL (base64) i przesyła do R2. Zwraca klucz obiektu i publiczny URL CDN. */
  async uploadBase64(dataUrl: string, prefix = 'floor-plans'): Promise<{ key: string; url: string }> {
    if (!this.client) throw new Error('R2 not configured');
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid dataUrl format');
    const [, mime, base64] = match;
    const ext = mime.includes('svg') ? 'svg' : 'png';
    const key = `${prefix}/${randomBytes(16).toString('hex')}.${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket:       this.bucket,
      Key:          key,
      Body:         Buffer.from(base64, 'base64'),
      ContentType:  mime,
      CacheControl: 'public, max-age=31536000',
    }));

    return { key, url: `${this.publicUrl}/${key}` };
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !key) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e: any) {
      this.logger.warn(`R2 delete failed for key ${key}: ${e.message}`);
    }
  }
}
