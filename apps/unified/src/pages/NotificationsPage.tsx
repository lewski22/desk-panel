import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn } from '../components/ui';
import { SmtpConfigSection } from './SmtpConfigSection';

// ── Kategorie ────────────────────────────────────────────────────
const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'infrastruktura', label: 'Infrastruktura IoT', icon: '📡' },
  { key: 'rezerwacje',     label: 'Rezerwacje',          icon: '📋' },
  { key: 'system',         label: 'System',              icon: '⚙️'  },
];

// ── Tag kategorii ────────────────────────────────────────────────
function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    infrastruktura: 'bg-red-50 text-red-600 border-red-200',
    rezerwacje:     'bg-blue-50 text-blue-600 border-blue-200',
    system:         'bg-purple-50 text-purple-600 border-purple-200',
  };
  const labels: Record<string, string> = {
    infrastruktura: 'IoT',
    rezerwacje:     'Rezerwacje',
    system:         'System',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${colors[cat] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
      {labels[cat] ?? cat}
    </span>
  );
}

// ── Recipients input ─────────────────────────────────────────────
function RecipientsInput({ value, onChange }: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const add = () => {
    const email = input.trim().toLowerCase();
    if (!email || value.includes(email)) { setInput(''); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    onChange([...value, email]);
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(e => (
          <span key={e} className="flex items-center gap-1 bg-zinc-100 text-zinc-700 text-xs px-2 py-1 rounded">
            {e}
            <button onClick={() => onChange(value.filter(x => x !== e))}
              className="text-zinc-400 hover:text-zinc-600 ml-0.5">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={t('notifications.settings.test_email')}
          className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B03472]/20"
        />
        <Btn size="sm" variant="secondary" onClick={add}>{t('btn.create')}</Btn>
      </div>
      {value.length === 0 && (
        <p className="text-[11px] text-zinc-400 mt-1.5">
          {t('notifications.empty_desc')}
        </p>
      )}
    </div>
  );
}

// ── Row dla pojedynczego powiadomienia ───────────────────────────
function NotificationRow({
  item, onChange,
}: {
  item: any;
  onChange: (patch: Partial<typeof item>) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl transition-colors ${item.enabled ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50/50'}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Toggle */}
        <button
          onClick={() => onChange({ enabled: !item.enabled })}
          className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors mt-0.5 ${item.enabled ? 'bg-[#B03472]' : 'bg-zinc-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.enabled ? 'translate-x-5' : ''}`} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${item.enabled ? 'text-zinc-800' : 'text-zinc-500'}`}>
              {item.label}
            </span>
            <CategoryBadge cat={item.category} />
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
        </div>

        {/* Expand button */}
        <button onClick={() => setExpanded(x => !x)}
          className="text-zinc-400 hover:text-zinc-600 text-xs flex items-center gap-1 flex-shrink-0">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 pt-3 space-y-3">
          {/* Threshold */}
          {item.hasThreshold && (
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                Próg czasowy (minuty ciszy → alert)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={120}
                  value={item.thresholdMin ?? 10}
                  onChange={e => onChange({ thresholdMin: parseInt(e.target.value) || 10 })}
                  className="w-24 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                />
                <span className="text-xs text-zinc-400">{t('notifications.settings.title')}</span>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1.5">
              Odbiorcy powiadomień
            </label>
            <RecipientsInput
              value={item.recipients ?? []}
              onChange={v => onChange({ recipients: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Główna strona ────────────────────────────────────────────────
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings]   = useState<any[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [err,      setErr]        = useState('');
  const [log,      setLog]        = useState<any[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testing,  setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [tab, setTab]             = useState<'settings' | 'log' | 'smtp'>('settings');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        appApi.notifications.getSettings(),
        appApi.notifications.getLog(),
      ]);
      setSettings(Array.isArray(s) ? s : []);
      setLog(Array.isArray(l) ? l : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (type: string, patch: any) => {
    setSettings(prev => prev.map(s => s.type === type ? { ...s, ...patch } : s));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await appApi.notifications.saveSettings(settings.map(s => ({
        type:         s.type,
        enabled:      s.enabled,
        recipients:   s.recipients ?? [],
        thresholdMin: s.thresholdMin,
      })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await appApi.notifications.testSend(testEmail);
      setTestResult(r.ok ? 'ok' : `Błąd: ${r.error}`);
    } catch (e: any) { setTestResult(`Błąd: ${e.message}`); }
    setTesting(false);
  };

  const groupedByCategory = CATEGORIES.map(cat => ({
    ...cat,
    items: settings.filter(s => s.category === cat.key),
  }));

  return (
    <div>
      <PageHeader
        title={t('pages.notifications.title')}
        subtitle={t('notifications.settings.title')}
        action={
          tab === 'settings' ? (
            <Btn onClick={handleSave} loading={saving}>
              {saved ? t('notifications.settings.saved') : t('notifications.settings.save')}
            </Btn>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6">
        {(['settings', 'smtp', 'log'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[#B03472] text-[#B03472]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {t === 'settings' ? `⚙️ ${tab === 'settings' ? t('notifications.settings.title') : t('notifications.settings.title')}` : t === 'smtp' ? `📧 ${t('notifications.settings.smtp_title')}` : '📋 Log'}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{err}</div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="space-y-8">
          {loading ? (
            <div className="text-center py-16 text-zinc-400 text-sm">{t('btn.saving').replace('…', '')}</div>
          ) : (
            <>
              {groupedByCategory.map(cat => cat.items.length > 0 && (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{cat.icon}</span>
                    <h3 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide">{cat.label}</h3>
                    <span className="text-xs text-zinc-400">({cat.items.length})</span>
                  </div>
                  <div className="space-y-2">
                    {cat.items.map(item => (
                      <NotificationRow
                        key={item.type}
                        item={item}
                        onChange={patch => handleChange(item.type, patch)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Test SMTP */}
              <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50">
                <h3 className="font-semibold text-zinc-700 text-sm mb-1">{t('notifications.settings.test_email')}</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Wyślij testowy email aby sprawdzić czy serwer pocztowy jest poprawnie skonfigurowany.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="twoj@email.pl"
                    className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <Btn size="sm" onClick={handleTest} loading={testing}>{t('notifications.settings.test_email')}</Btn>
                </div>
                {testResult && (
                  <p className={`mt-2 text-xs font-medium ${testResult === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                    {testResult === 'ok' ? t('notifications.settings.test_success') : testResult}
                  </p>
                )}
              </div>

              {/* SMTP hint */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">Konfiguracja SMTP (zmienne środowiskowe)</p>
                <pre className="text-[11px] text-blue-600 leading-relaxed">{
`SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=Reserti <noreply@reserti.pl>`
                }</pre>
              </div>
            </>
          )}
        </div>
      )}

      {/* SMTP tab */}
      {tab === 'smtp' && (
        <div className="space-y-6">
          <SmtpConfigSection />
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-zinc-600 mb-2">Jak to działa?</p>
            <ul className="text-xs text-zinc-500 space-y-1.5 list-none">
              <li>📧 <strong>Własna skrzynka</strong> — emaile wysyłane są z Twojego adresu (np. noreply@firma.pl). Pracownicy widzą email Twojej firmy, nie Reserti.</li>
              <li>🌐 <strong>Globalna skrzynka</strong> — emaile wysyłane przez administratora systemu Reserti. Nie wymaga konfiguracji.</li>
              <li>🔒 <strong>Bezpieczeństwo</strong> — hasło SMTP jest szyfrowane AES-256-GCM przed zapisem. Nigdy nie jest zwracane przez API.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Log tab */}
      {tab === 'log' && (
        <div>
          {log.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-sm">{t('notifications.empty_title')}</div>
          ) : (
            <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    {['Typ', 'Temat', 'Odbiorcy', 'Data', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, i) => (
                    <tr key={entry.id} className={`border-b border-zinc-50 ${i % 2 === 1 ? 'bg-zinc-50/50' : ''}`}>
                      <td className="px-4 py-2.5">
                        <code className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                          {entry.type}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-zinc-700 max-w-[240px] truncate">{entry.subject}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {entry.recipients?.slice(0, 2).join(', ')}
                        {entry.recipients?.length > 2 && ` +${entry.recipients.length - 2}`}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {new Date(entry.sentAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'pl-PL')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          entry.success
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {entry.success ? 'OK' : t('qr.error_title')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
