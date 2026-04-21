/**
 * WebhookConfigForm — Sprint F5
 * apps/unified/src/components/integrations/forms/WebhookConfigForm.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../../api/client';
import { Field, Toggle, FormActions, styles } from './AzureConfigForm';

const ALL_EVENTS = [
  'reservation.created', 'reservation.cancelled', 'reservation.expired',
  'checkin.nfc', 'checkin.qr', 'checkin.manual', 'checkout',
  'beacon.offline', 'beacon.online', 'gateway.offline', 'gateway.online',
] as const;

type WebhookEvent = typeof ALL_EVENTS[number];

interface Integration {
  publicConfig?: { url?: string; events?: string[]; hasSecret?: boolean; timeoutMs?: number; maxRetries?: number };
  isEnabled?:    boolean;
}

interface Props { integration?: Integration | null; onSaved: () => void; onCancel: () => void; }

export function WebhookConfigForm({ integration, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const pub = integration?.publicConfig ?? {};

  const [url,        setUrl]        = useState(pub.url ?? '');
  const [secret,     setSecret]     = useState('');
  const [events,     setEvents]     = useState<Set<WebhookEvent>>(
    new Set((pub.events ?? ALL_EVENTS.slice(0, 7)) as WebhookEvent[]),
  );
  const [timeoutMs,  setTimeoutMs]  = useState(pub.timeoutMs ?? 5000);
  const [maxRetries, setMaxRetries] = useState(pub.maxRetries ?? 3);
  const [headers,    setHeaders]    = useState('{}');
  const [isEnabled,  setIsEnabled]  = useState(integration?.isEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const toggleEvent = (e: WebhookEvent) => {
    setEvents(prev => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e); else next.add(e);
      return next;
    });
  };

  const handleSave = async () => {
    if (!url.trim()) { setError(t('integrations.webhook.url') + ' jest wymagany'); return; }
    if (!pub.hasSecret && !secret.trim()) { setError(t('integrations.webhook.secret') + ' jest wymagany'); return; }
    if (events.size === 0) { setError('Wybierz co najmniej jeden event'); return; }

    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(headers || '{}');
    } catch {
      setError('Nagłówki muszą być poprawnym JSON (np. {"Authorization": "Bearer xxx"})');
      return;
    }

    setSaving(true); setError('');
    try {
      const config: Record<string, unknown> = {
        url:        url.trim(),
        events:     Array.from(events),
        timeoutMs,
        maxRetries,
        headers:    Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
      };
      if (secret.trim()) config.secret = secret.trim();

      await appApi.integrations.upsert('WEBHOOK_CUSTOM', {
        config,
        displayName: `Webhook · ${new URL(url.trim()).hostname}`,
        tenantHint:  url.trim(),
        isEnabled,
      });
      onSaved();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h3 style={styles.title}>{t('integrations.providers.WEBHOOK_CUSTOM.name')}</h3>

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>Weryfikacja podpisu HMAC-SHA256</p>
        <p style={styles.infoBody}>
          Każdy request zawiera nagłówek <code>X-Reserti-Signature: sha256=&lt;hex&gt;</code>.<br />
          Weryfikuj: <code>HMAC-SHA256(secret, requestBody) === signature</code>
        </p>
      </div>

      <Field label={t('integrations.webhook.url')}>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder={t('integrations.webhook.url_placeholder')}
          style={{ ...styles.input, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </Field>

      <Field label={t('integrations.webhook.secret')} hint={t('integrations.webhook.secret_hint')}>
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
          placeholder={pub.hasSecret ? '••••••• (bez zmian)' : t('integrations.webhook.secret_placeholder')}
          style={styles.input} />
      </Field>

      {/* Events checkboxes */}
      <p style={styles.sectionLabel}>{t('integrations.webhook.events')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 14 }}>
        {ALL_EVENTS.map(ev => (
          <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0' }}>
            <input type="checkbox" checked={events.has(ev)} onChange={() => toggleEvent(ev)}
              style={{ width: 14, height: 14, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {t(`integrations.webhook.events_options.${ev}`, ev)}
            </span>
          </label>
        ))}
      </div>

      {/* Advanced */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <Field label={t('integrations.webhook.timeout')}>
          <input type="number" value={timeoutMs} onChange={e => setTimeoutMs(+e.target.value)}
            min={1000} max={30000} step={500} style={styles.input} />
        </Field>
        <Field label={t('integrations.webhook.max_retries')}>
          <input type="number" value={maxRetries} onChange={e => setMaxRetries(+e.target.value)}
            min={0} max={5} style={styles.input} />
        </Field>
      </div>

      <Field label={t('integrations.webhook.headers')} hint={t('integrations.webhook.headers_placeholder')}>
        <textarea value={headers} onChange={e => setHeaders(e.target.value)} rows={2}
          placeholder={t('integrations.webhook.headers_placeholder')}
          style={{ ...styles.input, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
      </Field>

      <div style={styles.toggleRow}>
        <span style={styles.toggleLabel}>Włącz webhook</span>
        <Toggle value={isEnabled} onChange={setIsEnabled} />
      </div>

      <FormActions error={error} saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}
