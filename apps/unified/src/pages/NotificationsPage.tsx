import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn } from '../components/ui';
import { SmtpConfigSection } from './SmtpConfigSection';

// ── Kategorie ────────────────────────────────────────────────────
const CATEGORIES: { key: string; icon: string }[] = [
  { key: 'infrastruktura', icon: '📡' },
  { key: 'rezerwacje',     icon: '📋' },
  { key: 'system',         icon: '⚙️'  },
];

// ── Tag kategorii ────────────────────────────────────────────────
function CategoryBadge({ cat }: { cat: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    infrastruktura: 'bg-red-50 text-red-600 border-red-200',
    rezerwacje:     'bg-blue-50 text-blue-600 border-blue-200',
    system:         'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${colors[cat] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
      {t(`notifications.category.${cat}`, cat)}
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
  item, onChange, isSA,
}: {
  item: any;
  onChange: (patch: Partial<typeof item>) => void;
  isSA: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // OA cannot edit recipients for infra/system — those are SA-managed
  const canEditRecipients = isSA || item.category === 'rezerwacje';

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
          {item.category === 'rezerwacje' && (
            <p className="text-[11px] text-zinc-300 mt-0.5">{t('notifications.reservation_user_note', 'Każdy użytkownik może włączyć/wyłączyć w swoim profilu')}</p>
          )}
        </div>

        {/* Expand button — only if there's anything to expand */}
        {(item.hasThreshold || canEditRecipients) && (
          <button onClick={() => setExpanded(x => !x)}
            className="text-zinc-400 hover:text-zinc-600 text-xs flex items-center gap-1 flex-shrink-0">
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100 pt-3 space-y-3">
          {/* Threshold */}
          {item.hasThreshold && (
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                {t('notifications.threshold_label')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={120}
                  value={item.thresholdMin ?? 10}
                  onChange={e => onChange({ thresholdMin: parseInt(e.target.value) || 10 })}
                  className="w-24 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                />
                <span className="text-xs text-zinc-400">min</span>
              </div>
            </div>
          )}

          {/* Recipients — SA for all, OA only for rezerwacje */}
          {canEditRecipients && (
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1.5">
                {t('notifications.recipients_label', 'Odbiorcy powiadomień')}
              </label>
              <RecipientsInput
                value={item.recipients ?? []}
                onChange={v => onChange({ recipients: v })}
              />
            </div>
          )}

          {/* SA-only: infra/system recipients scope hint */}
          {!canEditRecipients && isSA === false && (
            <p className="text-xs text-zinc-400 italic">
              {t('notifications.recipients_sa_only', 'Odbiorcy dla powiadomień infrastruktury są zarządzani przez administratora systemu.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers dla listy powiadomień ───────────────────────────────
const NOTIF_TYPE_ICON: Record<string, string> = {
  GATEWAY_OFFLINE:              '🔴',
  GATEWAY_BACK_ONLINE:          '🟢',
  BEACON_OFFLINE:               '🟠',
  FIRMWARE_UPDATE:              '🆙',
  GATEWAY_RESET_NEEDED:         '⚠️',
  RESERVATION_CHECKIN_MISSED:   '⏰',
  SYSTEM_ANNOUNCEMENT:          '📢',
  GATEWAY_KEY_ROTATION_FAILED:  '🔑',
};

function notifTimeAgo(dateStr: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return t('notifications.just_now');
  if (min < 60) return t('notifications.min_ago', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24)   return t('notifications.h_ago', { count: h });
  const d = Math.floor(h / 24);
  return t('notifications.d_ago', { count: d });
}

function notifGetLocalized(item: any, field: 'title' | 'body', lang: string): string {
  try {
    const meta = item.meta ? JSON.parse(item.meta) : null;
    const tr   = meta?.translations?.[lang] ?? meta?.translations?.['en'];
    if (tr?.[field]) return tr[field];
  } catch {}
  return item[field] ?? '';
}


// ── Lista in-app powiadomień ─────────────────────────────────────
function NotificationsList() {
  const { t, i18n } = useTranslation();
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await appApi.notifications.inapp()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkAll = async () => {
    await appApi.notifications.markAllRead();
    setItems((prev: any[]) => prev.map((n: any) => ({ ...n, read: true })));
  };

  const handleRead = async (id: string) => {
    await appApi.notifications.markRead([id]);
    setItems((prev: any[]) => prev.map((n: any) => n.id === id ? { ...n, read: true } : n));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await appApi.notifications.deleteOne(id);
    setItems((prev: any[]) => prev.filter((n: any) => n.id !== id));
  };

  if (loading) return <div className="text-center py-16 text-zinc-400 text-sm">…</div>;

  if (items.length === 0) return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🔔</div>
      <p className="text-zinc-400 text-sm">{t('notifications.empty_title')}</p>
    </div>
  );

  const unread = items.filter((n: any) => !n.read).length;

  return (
    <div>
      {unread > 0 && (
        <div className="flex justify-end mb-3">
          <button onClick={handleMarkAll} className="text-xs text-brand font-semibold hover:underline">
            {t('notifications.mark_all')}
          </button>
        </div>
      )}
      <div className="space-y-2">
        {items.map((item: any) => (
          <div
            key={item.id}
            onClick={() => !item.read && handleRead(item.id)}
            className={`group flex gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
              item.read
                ? 'bg-white border-zinc-100 hover:bg-zinc-50'
                : 'bg-brand/5 border-brand/20 hover:bg-brand/10'
            }`}
          >
            <div className="flex-shrink-0 pt-1.5">
              {!item.read
                ? <div className="w-2 h-2 rounded-full bg-brand" />
                : <div className="w-2 h-2" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm flex-shrink-0">{NOTIF_TYPE_ICON[item.type] ?? '🔔'}</span>
                  <p className={`text-sm font-medium truncate ${item.read ? 'text-zinc-500' : 'text-zinc-800'}`}>
                    {notifGetLocalized(item, 'title', i18n.language)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                    {notifTimeAgo(item.createdAt, t)}
                  </span>
                  <button
                    onClick={e => handleDelete(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 p-0.5 rounded text-xs leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {notifGetLocalized(item, 'body', i18n.language)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Push Notifications opt-in ────────────────────────────────────
function PushOptInSection() {
  const { t }  = useTranslation();
  const [status, setStatus]   = useState<'unknown'|'granted'|'denied'|'unsupported'>('unknown');
  const [subbed, setSubbed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported'); return;
    }
    setStatus(Notification.permission as any);
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubbed(!!sub))
    ).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setLoading(true); setErr(null);
    try {
      const { publicKey } = await appApi.push.getVapidKey();
      if (!publicKey) throw new Error('Push nie jest skonfigurowany na serwerze');
      const perm = await Notification.requestPermission();
      setStatus(perm as any);
      if (perm !== 'granted') throw new Error(t('push.permission_denied'));
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      const p256dhKey = sub.getKey('p256dh')!;
      const authKey   = sub.getKey('auth')!;
      await appApi.push.subscribe({
        endpoint:  sub.endpoint,
        p256dh:    btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
        auth:      btoa(String.fromCharCode(...new Uint8Array(authKey))),
        userAgent: navigator.userAgent.slice(0, 200),
      });
      setSubbed(true);
    } catch (e: any) { setErr(e.message ?? t('common.error')); }
    setLoading(false);
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await appApi.push.unsubscribe(sub.endpoint); await sub.unsubscribe(); }
      setSubbed(false);
    } catch {}
    setLoading(false);
  };

  if (subbed || status === 'granted') return (
    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
      <span>✓</span>
      <span>
        {t('push.active', 'Push aktywny w tej przeglądarce')}
        {' — '}
        <button onClick={handleUnsubscribe} className="underline hover:no-underline">
          {t('push.disable', 'wyłącz')}
        </button>
      </span>
    </div>
  );

  if (status === 'denied') return (
    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      {t('push.denied_hint', 'Powiadomienia push zablokowane przez przeglądarkę. Odblokuj w ustawieniach strony (🔒 → Powiadomienia).')}
    </div>
  );

  if (status === 'unsupported') return (
    <p className="text-xs text-zinc-400">
      {t('push.unsupported', 'Ta przeglądarka nie obsługuje push — używaj powiadomień w dzwonku 🔔.')}
    </p>
  );

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={handleSubscribe} disabled={loading}
        className="text-xs px-4 py-2 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors">
        {loading ? '…' : t('push.enable_btn', 'Włącz powiadomienia push')}
      </button>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const authUser = appApi.auth.user();
  const orgId    = authUser?.organizationId ?? '';
  const isSA     = authUser?.role === 'SUPER_ADMIN';
  const [settings, setSettings]   = useState<any[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [err,      setErr]        = useState('');
  const [log,      setLog]        = useState<any[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testing,  setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [tab, setTab]             = useState<'list' | 'settings' | 'log' | 'smtp'>('list');
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        appApi.notifications.getSettings(orgId),
        appApi.notifications.getLog(orgId),
      ]);
      setSettings(Array.isArray(s) ? s : []);
      setLog(Array.isArray(l) ? l : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    appApi.notifications.countUnread()
      .then((r: any) => setUnreadCount(r.count ?? 0))
      .catch(() => {});
  }, []);

  const handleChange = (type: string, patch: any) => {
    setSettings(prev => prev.map(s => s.type === type ? { ...s, ...patch } : s));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await Promise.all(settings.map(s =>
        appApi.notifications.saveSettings(orgId, s.type, {
          enabled:      s.enabled,
          recipients:   s.recipients ?? [],
          thresholdMin: s.thresholdMin,
        })
      ));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      await appApi.notifications.testSmtp(orgId);
      setTestResult('ok');
    } catch (e: any) { setTestResult(`Błąd: ${e.message}`); }
    setTesting(false);
  };

  const groupedByCategory = CATEGORIES.map(cat => ({
    ...cat,
    label: t(`notifications.category.${cat.key}`, cat.key),
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
      <div className="flex border-b border-zinc-200 mb-6 overflow-x-auto">
        {/* Lista powiadomień — zawsze pierwsza */}
        <button onClick={() => setTab('list')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'list' ? 'border-[#B03472] text-[#B03472]' : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}>
          🔔 {t('notifications.tab_list', 'Moje powiadomienia')}
          {unreadCount > 0 && (
            <span className="bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </button>

        {(['settings', ...(isSA ? ['smtp'] : []), 'log'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === tabKey ? 'border-[#B03472] text-[#B03472]' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {tabKey === 'settings'
              ? `⚙️ ${t('notifications.settings.title')}`
              : tabKey === 'smtp'
                ? `📧 ${t('notifications.settings.smtp_title')}`
                : `📋 ${t('notifications.log_tab')}`}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{err}</div>
      )}

      {/* Lista powiadomień */}
      {tab === 'list' && <NotificationsList />}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="space-y-8">

          {/* Baner: in-app zawsze aktywne */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
            <span className="text-emerald-600 text-lg shrink-0 mt-0.5">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {t('notifications.inapp_active_title', 'Powiadomienia w aplikacji są aktywne')}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                {t('notifications.inapp_active_desc', 'Otrzymujesz powiadomienia przez dzwonek 🔔 w panelu. Nie wymaga żadnej konfiguracji.')}
              </p>
            </div>
          </div>

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
                        isSA={isSA}
                        onChange={patch => handleChange(item.type, patch)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Test SMTP — SA only */}
              {isSA && (
                <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50">
                  <h3 className="font-semibold text-zinc-700 text-sm mb-1">{t('notifications.settings.test_email')}</h3>
                  <p className="text-xs text-zinc-400 mb-3">
                    {t('notifications.test_email_hint')}
                  </p>
                  <div className="flex gap-2">
                    <Btn size="sm" onClick={handleTest} loading={testing}>{t('notifications.settings.test_email')}</Btn>
                  </div>
                  {testResult && (
                    <p className={`mt-2 text-xs font-medium ${testResult === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                      {testResult === 'ok' ? t('notifications.settings.test_success') : testResult}
                    </p>
                  )}
                </div>
              )}

              {/* SMTP hint — SA only */}
              {isSA && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-1">{t('notifications.smtp_env_hint')}</p>
                  <pre className="text-[11px] text-blue-600 leading-relaxed">{
`SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=Reserti <noreply@reserti.pl>`
                  }</pre>
                </div>
              )}
              {/* Push opt-in — oddzielona sekcja, opcjonalna */}
              <div className="border-t border-zinc-100 pt-5">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
                    {t('push.browser_title', 'Powiadomienia push przeglądarki')}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                      {t('common.optional', 'opcjonalne')}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {t('push.browser_desc', 'Jeśli włączysz, będziesz otrzymywać wyskakujące okienka systemowe nawet gdy aplikacja jest w tle. Powiadomienia w dzwonku 🔔 działają niezależnie od tej opcji.')}
                  </p>
                </div>
                <PushOptInSection />
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
            <p className="text-xs font-semibold text-zinc-600 mb-2">{t('notifications.smtp_how_title')}</p>
            <ul className="text-xs text-zinc-500 space-y-1.5 list-none">
              <li>📧 <strong>{t('notifications.smtp_own_label')}</strong> — {t('notifications.smtp_how_own')}</li>
              <li>🌐 <strong>{t('notifications.smtp_global_label')}</strong> — {t('notifications.smtp_how_global')}</li>
              <li>🔒 <strong>{t('notifications.smtp_secure_label')}</strong> — {t('notifications.smtp_how_secure')}</li>
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
                    {[t('notifications.log.col_type'), t('notifications.log.col_subject'), t('notifications.log.col_recipients'), t('notifications.log.col_date'), t('notifications.log.col_status')].map(h => (
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
