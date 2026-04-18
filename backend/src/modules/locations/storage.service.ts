/**
 * StorageService — Sprint C debt #3
 *
 * Obsługuje upload plików do Cloudflare R2 (kompatybilny z S3).
 * Jeśli zmienne R2_* nie są ustawione → fallback: zwraca base64 data URL
 * (zachowanie sprzed migracji, bez ryzyka regresu).
 *
 * Zależności: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
 *
 * backend/src/shared/storage.service.ts
 */
import { Injectable, Logger }  from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { extname }             from 'path';
import { randomBytes }         from 'crypto';

export interface UploadResult {
  url:      string; // publiczny URL pliku (lub base64 data URL jako fallback)
  key:      string; // S3 klucz (lub pusty string dla base64)
  backend:  'r2' | 'db'; // który backend użyty
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // Lazy-loaded S3 client — importujemy dynamicznie żeby nie crashować
  // jeśli paczka nie jest zainstalowana
  private _s3: any = null;
  private _bucket: string | undefined;
  private _publicUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this._bucket    = config.get<string>('R2_BUCKET_NAME');
    this._publicUrl = config.get<string>('R2_PUBLIC_URL');
  }

  // ── Inicjalizacja S3 klienta (R2 lub standardowe S3) ────────
  private async getS3() {
    if (this._s3) return this._s3;

    const accountId  = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKey  = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretKey  = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    // Jeśli brak credentiali — nie ładuj S3 klienta
    if (!accountId || !accessKey || !secretKey || !this._bucket) return null;

    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this._s3 = new S3Client({
        region:   'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId:     accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.logger.log('R2 storage initialized');
      return this._s3;
    } catch {
      this.logger.warn('@aws-sdk/client-s3 not installed — run: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage');
      return null;
    }
  }

  // ── Upload planu piętra ──────────────────────────────────────
  /**
   * Akceptuje base64 data URL (z obecnego frontendu) lub Buffer.
   * Jeśli R2 nie jest skonfigurowany → zwraca base64 jako URL (backwards compat).
   */
  async uploadFloorPlan(
    orgId:      string,
    locationId: string,
    data:       string | Buffer,  // base64 data URL lub raw Buffer
    mimeType?:  string,
  ): Promise<UploadResult> {
    // Dekoduj base64 data URL jeśli potrzeba
    let buffer: Buffer;
    let mime:   string;

    if (typeof data === 'string' && data.startsWith('data:')) {
      const [header, b64] = data.split(',');
      mime   = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
      buffer = Buffer.from(b64, 'base64');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
      mime   = mimeType ?? 'image/png';
    } else {
      // Zwykły string (np. już URL) — zwróć bez uploadu
      return { url: data as string, key: '', backend: 'db' };
    }

    // Sprawdź rozmiar — R2 limit jest duży, ale DB limit to ~2MB base64
    const sizeMB = buffer.length / 1024 / 1024;
    if (sizeMB > 10) {
      throw new Error(`Floor plan too large: ${sizeMB.toFixed(1)}MB (max 10MB)`);
    }

    const s3 = await this.getS3();

    // ── Fallback: brak R2 → zwróć base64 do DB ────────────────
    if (!s3 || !this._bucket || !this._publicUrl) {
      if (sizeMB > 2) {
        throw new Error(
          `Floor plan ${sizeMB.toFixed(1)}MB exceeds DB limit (2MB). Configure R2_* env vars.`
        );
      }
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      return { url: dataUrl, key: '', backend: 'db' };
    }

    // ── Upload do R2 ───────────────────────────────────────────
    const ext = mime.split('/')[1] ?? 'png';
    const key = `floor-plans/${orgId}/${locationId}/${randomBytes(8).toString('hex')}.${ext}`;

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await s3.send(new PutObjectCommand({
        Bucket:      this._bucket,
        Key:         key,
        Body:        buffer,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      const url = `${this._publicUrl.replace(/\/$/, '')}/${key}`;
      this.logger.log(`Floor plan uploaded: ${key} (${sizeMB.toFixed(2)}MB)`);
      return { url, key, backend: 'r2' };
    } catch (err: any) {
      this.logger.error(`R2 upload failed: ${err.message}`);
      throw new Error(`Storage upload failed: ${err.message}`);
    }
  }

  // ── Usuń stary plik z R2 ─────────────────────────────────────
  async deleteFloorPlan(key: string): Promise<void> {
    if (!key) return;
    const s3 = await this.getS3();
    if (!s3 || !this._bucket) return;

    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await s3.send(new DeleteObjectCommand({ Bucket: this._bucket, Key: key }));
      this.logger.log(`Floor plan deleted: ${key}`);
    } catch (err: any) {
      this.logger.warn(`R2 delete failed (non-fatal): ${err.message}`);
    }
  }

  get isConfigured(): boolean {
    return !!(
      this.config.get('R2_ACCOUNT_ID') &&
      this.config.get('R2_ACCESS_KEY_ID') &&
      this.config.get('R2_SECRET_ACCESS_KEY') &&
      this._bucket &&
      this._publicUrl
    );
  }
}
