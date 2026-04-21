import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn } from '../components/ui';

// ── Sekcja konfiguracji SMTP per organizacja ─────────────────────
// Pozwala SUPER_ADMINowi podłączyć własną skrzynkę pocztową.
// Hasło jest szyfrowane AES-256-GCM na backendzie przed zapisem do DB.
// Gdy skonfigurowana — emaile org idą przez tę skrzynkę.
// Gdy brak — fallback na globalny SMTP z env backendu.

interface SmtpStatus {
  config:          SmtpPublic | null;
  globalAvailable: boolean;
}
interface SmtpPublic {
  host:         string;
  port:         number;
  secure:       boolean;
  user:         string;
  fromName:     string;
  fromEmail:    string;
  isVerified:   boolean;
  lastTestedAt: string | null;
}

const PRESET_PROVIDERS = [
  { labelKey: null,       label: 'Gmail',        host: 'smtp.gmail.com',       port: 587, secure: false },
  { labelKey: null,       label: 'Outlook/M365', host: 'smtp.office365.com',   port: 587, secure: false },
  { labelKey: null,       label: 'SendGrid',     host: 'smtp.sendgrid.net',    port: 587, secure: false },
  { labelKey: null,       label: 'Brevo',        host: 'smtp-relay.brevo.com', port: 587, secure: false },
  { labelKey: 'smtp.preset_other', label: 'Other…', host: '',                 port: 587, secure: false },
];

export function SmtpConfigSection() {
  const { t, i18n } = useTranslation();
  const [status,   setStatus]   = useState<SmtpStatus | null>(null);
  const [editing,  setEditing]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [err,      setErr]      = useState('');

  const [form, setForm] = useState({
    host: '', port: 587, secure: false,
    user: '', password: '',
    fromName: 'Reserti', fromEmail: '',
  });

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await appApi.notifications.getSmtp();
      setStatus(s);
      if (s?.config) {
        setForm(prev => ({
          ...prev,
          host:      s.config.host,
          port:      s.config.port,
          secure:    s.config.secure,
          user:      s.config.user,
          fromName:  s.config.fromName,
          fromEmail: s.config.fromEmail,
          password:  '', // nigdy nie zwracamy hasła
        }));
      }
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const applyPreset = (preset: typeof PRESET_PROVIDERS[0]) => {
    if (preset.host) {
      setForm(p => ({ ...p, host: preset.host, port: preset.port, secure: preset.secure }));
    }
  };

  const handleSave = async () => {
    if (!form.host || !form.user || !form.fromEmail) {
      setErr(t('notifications.empty_desc')); return;
    }
    if (!status?.config && !form.password) {
      setErr(t('notifications.empty_desc')); return;
    }
    setSaving(true); setErr('');
    try {
      await appApi.notifications.saveSmtp(form);
      await loadStatus();
      setEditing(false);
      setTestResult(null);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await appApi.notifications.testSmtp(testEmail);
      setTestResult({ ok: r.ok, msg: r.ok ? t('notifications.settings.test_success') : (r.error ?? t('qr.error_title')) });
      if (r.ok) loadStatus(); // odśwież isVerified
    } catch (e: any) { setTestResult({ ok: false, msg: e.message }); }
    setTesting(false);
  };

  const handleDelete = async () => {
    if (!confirm(t('notifications.settings.smtp_title'))) return;
    setDeleting(true);
    try {
      await appApi.notifications.deleteSmtp();
      await loadStatus();
      setEditing(false);
      setForm({ host: '', port: 587, secure: false, user: '', password: '', fromName: 'Reserti', fromEmail: '' });
    } catch { }
    setDeleting(false);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  if (loading) return <div className="text-sm text-zinc-400 py-4">{t('btn.saving').replace('…','')}</div>;

  const cfg = status?.config;

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-zinc-50 border-b border-zinc-200">
        <div>
          <h3 className="font-semibold text-zinc-800 text-sm">{t('smtp.mailbox_title')}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {cfg
              ? t('notifications.settings.smtp_title')
              : status?.globalAvailable
                ? t('notifications.settings.title')
                : t('notifications.empty_desc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cfg && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              cfg.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-600'
            }`}>
              {cfg.isVerified ? '✓ ' + t('notifications.settings.test_success') : '⚠ ' + t('notifications.settings.title')}
            </span>
          )}
          <Btn size="sm" variant="secondary" onClick={() => { setEditing(e => !e); setErr(''); setTestResult(null); }}>
            {editing ? t('btn.cancel') : cfg ? t('users.actions.edit') : t('notifications.settings.smtp_title')}
          </Btn>
        </div>
      </div>

      {/* Status (gdy nie edytujemy) */}
      {!editing && cfg && (
        <div className="px-5 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {[
              [t('smtp.smtp_server_label'), `${cfg.host}:${cfg.port}${cfg.secure ? ' (SSL)' : ' (TLS)'}`],
              [t('smtp.user_short'), cfg.user],
              [t('smtp.sender'), `${cfg.fromName} <${cfg.fromEmail}>`],
              [t('smtp.last_test'), cfg.lastTestedAt
                ? new Date(cfg.lastTestedAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'pl-PL')
                : t('provisioning.gateway.never')],
            ].map(([label, val]) => (
              <React.Fragment key={label}>
                <span className="text-zinc-400 text-xs">{label}</span>
                <span className="text-zinc-700 text-xs font-medium">{val}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Test */}
          <div className="flex gap-2 pt-2 border-t border-zinc-100 mt-2">
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
              placeholder={t('notifications.settings.test_email')} className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
            <Btn size="sm" onClick={handleTest} loading={testing}>{t('notifications.settings.test_email')}</Btn>
            <Btn size="sm" variant="danger" onClick={handleDelete} loading={deleting}>{t('users.actions.delete_data')}</Btn>
          </div>
          {testResult && (
            <p className={`text-xs font-medium ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {testResult.ok ? `✓ ${testResult.msg}` : `✗ ${testResult.msg}`}
            </p>
          )}
        </div>
      )}

      {/* Brak konfiguracji + global info */}
      {!editing && !cfg && (
        <div className="px-5 py-4">
          <div className={`rounded-lg p-3 text-xs ${status?.globalAvailable ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
            {status?.globalAvailable
              ? `✓ ${t('smtp.global_available')}`
              : `⚠ ${t('smtp.no_config')}`}
          </div>
        </div>
      )}

      {/* Formularz edycji */}
      {editing && (
        <div className="px-5 py-4 space-y-4">
          {/* Presets */}
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-2">{t('smtp.quick_preset')}</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROVIDERS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.host === p.host && p.host
                      ? 'bg-[#B03472] text-white border-[#B03472]'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}>
                  {p.labelKey ? t(p.labelKey) : p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-zinc-600 block mb-1">{t('smtp.server_label')}</label>
              <input value={form.host} onChange={f('host')} placeholder="np. smtp.gmail.com"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">{t('smtp.port_label')}</label>
              <input type="number" value={form.port} onChange={f('port')}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.secure} onChange={f('secure')} className="rounded" />
                <span className="text-xs text-zinc-600">SSL/TLS (port 465)</span>
              </label>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">{t('smtp.user_label')}</label>
              <input value={form.user} onChange={f('user')} placeholder="np. twoj@firma.pl lub apikey"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                {t('smtp.password_label')} {cfg ? t('smtp.password_leave_empty') : '*'}
              </label>
              <input type="password" value={form.password} onChange={f('password')}
                placeholder={cfg ? t('smtp.password_placeholder_existing') : t('smtp.password_placeholder_new')}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">{t('smtp.from_name_label')}</label>
              <input value={form.fromName} onChange={f('fromName')} placeholder="np. Biuro ABC"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">{t('smtp.from_email_label')}</label>
              <input type="email" value={form.fromEmail} onChange={f('fromEmail')} placeholder="noreply@firma.pl"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" onClick={() => { setEditing(false); setErr(''); }}>{t('btn.cancel')}</Btn>
            <Btn onClick={handleSave} loading={saving}>{t('notifications.settings.save')}</Btn>
          </div>

          <p className="text-[11px] text-zinc-400">
            🔒 {t('smtp.encrypted_hint')}
          </p>
        </div>
      )}
    </div>
  );
}
