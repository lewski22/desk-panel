/**
 * MailerService — wysyłanie emaili z obsługą SMTP per organizacja.
 *
 * Hierarchia transporterów:
 *   1. Własny SMTP organizacji (OrganizationSmtpConfig) — priorytet, lazy init z cache
 *   2. Globalny SMTP z env (SMTP_HOST, SMTP_PORT, …) — fallback systemowy
 *   3. Brak SMTP — email pomijany, log warn (graceful degradation)
 *
 * Hasła SMTP szyfrowane AES-256-GCM przez smtp-crypto.ts (klucz SMTP_ENCRYPTION_KEY).
 * Metoda buildHtml() generuje responsywny szablon HTML branded Reserti.
 *
 * backend/src/modules/notifications/mailer.service.ts
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService }          from '../../database/prisma.service';
import { encryptSmtpPassword, decryptSmtpPassword } from './smtp-crypto';

export interface MailOptions {
  to:       string | string[];
  subject:  string;
  html:     string;
  text?:    string;
}

export interface SmtpConfigInput {
  host:      string;
  port:      number;
  secure:    boolean;
  user:      string;
  password:  string;   // plaintext — szyfrujemy przed zapisem
  fromName:  string;
  fromEmail: string;
}

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  // Globalny transporter (z env backendu)
  private globalTransporter: Transporter | null = null;
  private globalFrom: string;
  // Cache transporterów per org — lazy init
  private orgTransporters = new Map<string, { transporter: Transporter; from: string }>();

  constructor(
    private config:  ConfigService,
    private prisma:  PrismaService,
  ) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST not set — global email disabled. Orgs with own SMTP will still work.');
      return;
    }
    this.globalFrom = this.config.get<string>('SMTP_FROM', 'Reserti <noreply@reserti.pl>');
    this.globalTransporter = nodemailer.createTransport({
      host,
      port:   this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    this.logger.log(`Global SMTP ready — ${host}:${this.config.get('SMTP_PORT', 587)}`);
  }

  // ── Wyślij email — auto-wybór transportera (org → global) ─────
  async send(opts: MailOptions, organizationId?: string): Promise<{ ok: boolean; error?: string }> {
    const { transporter, from } = await this._getTransporter(organizationId);

    if (!transporter) {
      this.logger.warn(`Email skipped (no SMTP): ${opts.subject}`);
      return { ok: false, error: 'SMTP not configured' };
    }

    const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
    try {
      await transporter.sendMail({ from, to, subject: opts.subject, html: opts.html, text: opts.text ?? opts.subject });
      this.logger.log(`Email sent [${organizationId ? 'org-smtp' : 'global'}]: "${opts.subject}" → ${to}`);
      return { ok: true };
    } catch (err: any) {
      this.logger.error(`Email failed: "${opts.subject}" → ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // ── CRUD konfiguracji SMTP per org ───────────────────────────
  async saveOrgSmtp(organizationId: string, input: SmtpConfigInput) {
    const passwordEnc = encryptSmtpPassword(input.password);
    const data = {
      host:        input.host,
      port:        input.port,
      secure:      input.secure,
      user:        input.user,
      passwordEnc,
      fromName:    input.fromName,
      fromEmail:   input.fromEmail,
      isVerified:  false,
      updatedAt:   new Date(),
    };
    await this.prisma.organizationSmtpConfig.upsert({
      where:  { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
    // Invaliduj cache
    this.orgTransporters.delete(organizationId);
  }

  async getOrgSmtpPublic(organizationId: string) {
    const cfg = await this.prisma.organizationSmtpConfig.findUnique({
      where: { organizationId },
    });
    if (!cfg) return null;
    // Nigdy nie zwracamy hasła — tylko metadane
    return {
      host:         cfg.host,
      port:         cfg.port,
      secure:       cfg.secure,
      user:         cfg.user,
      fromName:     cfg.fromName,
      fromEmail:    cfg.fromEmail,
      isVerified:   cfg.isVerified,
      lastTestedAt: cfg.lastTestedAt,
    };
  }

  async deleteOrgSmtp(organizationId: string) {
    await this.prisma.organizationSmtpConfig.delete({ where: { organizationId } }).catch(() => {});
    this.orgTransporters.delete(organizationId);
  }

  // ── Test połączenia SMTP ──────────────────────────────────────
  async testOrgSmtp(organizationId: string, toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const { transporter, from } = await this._getTransporter(organizationId);
    if (!transporter) return { ok: false, error: 'Brak konfiguracji SMTP' };

    try {
      await transporter.verify();
      await transporter.sendMail({
        from,
        to:      toEmail,
        subject: '✅ Test konfiguracji SMTP — Reserti',
        html:    this.buildHtml({
          title: 'Test skrzynki pocztowej',
          body:  '<p>Konfiguracja SMTP dla Twojej organizacji działa poprawnie.</p>',
        }),
      });
      // Oznacz jako zweryfikowany
      await this.prisma.organizationSmtpConfig.update({
        where: { organizationId },
        data:  { isVerified: true, lastTestedAt: new Date() },
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Sprawdź czy org ma własny SMTP ───────────────────────────
  get isGlobalConfigured(): boolean {
    return this.globalTransporter !== null;
  }

  async isOrgSmtpConfigured(organizationId: string): Promise<boolean> {
    const cfg = await this.prisma.organizationSmtpConfig.findUnique({
      where: { organizationId },
    });
    return !!cfg;
  }

  // ── HTML template helper ──────────────────────────────────────
  buildHtml(opts: {
    title: string; body: string;
    ctaLabel?: string; ctaUrl?: string;
    footer?: string; color?: string;
  }): string {
    const accent = opts.color ?? '#B03472';
    const cta = opts.ctaLabel && opts.ctaUrl ? `
      <div style="text-align:center;margin:28px 0">
        <a href="${opts.ctaUrl}"
           style="background:${accent};color:#fff;padding:12px 28px;border-radius:8px;
                  text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
          ${opts.ctaLabel}
        </a>
      </div>` : '';
    return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden">
    <div style="background:${accent};padding:24px 32px">
      <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em">RESERTI</span>
      <span style="color:rgba(255,255,255,0.6);font-size:13px;margin-left:8px">Desk Management</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a2e">${opts.title}</h2>
      <div style="font-size:14px;color:#4b5563;line-height:1.7">${opts.body}</div>
      ${cta}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        ${opts.footer ?? 'Reserti &mdash; System zarządzania biurkami IoT &bull; Wiadomość wygenerowana automatycznie.'}
      </p>
    </div>
  </div>
</body></html>`;
  }

  // ── Private: wybierz transporter ─────────────────────────────
  private async _getTransporter(
    organizationId?: string
  ): Promise<{ transporter: Transporter | null; from: string }> {
    // Próbuj własny SMTP organizacji
    if (organizationId) {
      if (this.orgTransporters.has(organizationId)) {
        return this.orgTransporters.get(organizationId)!;
      }

      const cfg = await this.prisma.organizationSmtpConfig.findUnique({
        where: { organizationId },
      });

      if (cfg) {
        try {
          const password = decryptSmtpPassword(cfg.passwordEnc);
          const t = nodemailer.createTransport({
            host:   cfg.host,
            port:   cfg.port,
            secure: cfg.secure,
            auth:   { user: cfg.user, pass: password },
          });
          const from = `${cfg.fromName} <${cfg.fromEmail}>`;
          const entry = { transporter: t, from };
          this.orgTransporters.set(organizationId, entry);
          return entry;
        } catch (e: any) {
          this.logger.warn(`Org SMTP decrypt failed (${organizationId}): ${e.message} — falling back to global`);
        }
      }
    }

    // Fallback: globalny SMTP
    return {
      transporter: this.globalTransporter,
      from:        this.globalFrom ?? 'Reserti <noreply@reserti.pl>',
    };
  }
}
