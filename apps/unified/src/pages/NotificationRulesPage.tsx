// i18n audit P3
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Modal, Input } from '../components/ui';
import { toast } from '../components/ui/Toast';

const ALL_ROLES = [
  { key: 'SUPER_ADMIN',  color: 'bg-purple-100 text-purple-700' },
  { key: 'OFFICE_ADMIN', color: 'bg-blue-100 text-blue-700' },
  { key: 'STAFF',        color: 'bg-teal-100 text-teal-700' },
  { key: 'END_USER',     color: 'bg-zinc-100 text-zinc-600' },
];

const TYPE_ICON: Record<string, string> = {
  GATEWAY_OFFLINE:            '🔴',
  GATEWAY_BACK_ONLINE:        '🟢',
  BEACON_OFFLINE:             '🟠',
  FIRMWARE_UPDATE:            '🆙',
  GATEWAY_RESET_NEEDED:       '⚠️',
  RESERVATION_CHECKIN_MISSED: '⏰',
  SYSTEM_ANNOUNCEMENT:        '📢',
};

function RoleTag({ role }: { role: string }) {
  const { t } = useTranslation();
  const r = ALL_ROLES.find(x => x.key === role);
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${r?.color ?? 'bg-zinc-100 text-zinc-500'}`}>
      {t(`roles.${role}`, role)}
    </span>
  );
}

// ── Modal: nowe ogłoszenie ────────────────────────────────────────
function AnnounceModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [roles,   setRoles]   = useState<string[]>(['SUPER_ADMIN', 'OFFICE_ADMIN']);
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ count: number } | null>(null);
  const [err,     setErr]     = useState('');

  const toggleRole = (r: string) =>
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const send = async () => {
    if (!title.trim() || !body.trim()) { setErr(t('notifications.rules.announce')); return; }
    if (!roles.length) { setErr(t('notifications.rules.announce')); return; }
    setSending(true); setErr('');
    try {
      const r = await appApi.inapp.announce({ title, body, targetRoles: roles });
      setResult(r);
    } catch (e: any) { setErr(e.message); }
    setSending(false);
  };

  if (result) return (
    <Modal title={t('notifications.rules.saved')} onClose={onClose}>
      <p className="text-green-600 font-semibold mb-2">{t('notifications.rules.saved')}</p>
      <p className="text-sm text-zinc-500">{t('notifications.announce.delivered', { count: result.count })}</p>
      <div className="mt-4"><Btn onClick={onClose}>{t('btn.cancel')}</Btn></div>
    </Modal>
  );

  return (
    <Modal title={t('notifications.rules.announce')} onClose={onClose}>
      <div className="space-y-4">
        <Input label={t('notifications.rules.title') || 'Tytuł *'} value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Zaplanowana przerwa techniczna" />
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">{t('notifications.rules.subtitle')}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
            placeholder="Treść ogłoszenia widoczna dla użytkowników..."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#B03472]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-2">{t('notifications.rules.subtitle')}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map(r => (
              <button key={r.key} onClick={() => toggleRole(r.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  roles.includes(r.key)
                    ? 'bg-[#B03472] text-white border-[#B03472]'
                    : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                }`}>
                {t(`roles.${r.key}`, r.key)}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={send} loading={sending}>{t('notifications.rules.announce')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── Główna strona ─────────────────────────────────────────────────
export function NotificationRulesPage() {
  const { t } = useTranslation();
  const [rules,        setRules]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [err,          setErr]          = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await appApi.inapp.getRules();
      setRules(Array.isArray(r) ? r : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRule = (type: string) =>
    setRules(prev => prev.map(r => r.type === type ? { ...r, enabled: !r.enabled } : r));

  const toggleRole = (type: string, role: string) =>
    setRules(prev => prev.map(r => {
      if (r.type !== type) return r;
      const roles = r.targetRoles.includes(role)
        ? r.targetRoles.filter((x: string) => x !== role)
        : [...r.targetRoles, role];
      return { ...r, targetRoles: roles };
    }));

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.inapp.saveRules(rules.map(r => ({
        type:        r.type,
        enabled:     r.enabled,
        targetRoles: r.targetRoles,
      })));
      toast(t('toast.rules_saved', 'Reguły zapisano'));
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title={t('pages.notificationRules.title')}
        subtitle={t('notifications.rules.subtitle')}
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setShowAnnounce(true)}>{t('notifications.rules.announce')}</Btn>
            <Btn onClick={handleSave} loading={saving}>
              {t('notifications.rules.save')}
            </Btn>
          </div>
        }
      />

      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{err}</div>}

      {/* Info */}
      <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <strong>{t('notifications.announce.rules_how')}</strong> {t('notifications.announce.rules_how_body')}
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">{t('btn.saving').replace('…','')}</div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.type}
              className={`border rounded-xl p-4 transition-colors ${
                rule.enabled ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-60'
              }`}>
              <div className="flex items-start gap-4">
                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.type)}
                  className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors mt-1 ${
                    rule.enabled ? 'bg-[#B03472]' : 'bg-zinc-300'
                  }`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
                </button>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{TYPE_ICON[rule.type] ?? '🔔'}</span>
                    <span className="font-semibold text-sm text-zinc-800">{rule.label}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">{rule.description}</p>

                  {/* Role toggles */}
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                      {t('notifications.rules.title')}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_ROLES.map(r => {
                        const active = rule.targetRoles.includes(r.key);
                        return (
                          <button
                            key={r.key}
                            onClick={() => rule.enabled && toggleRole(rule.type, r.key)}
                            disabled={!rule.enabled}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                              active
                                ? 'bg-[#B03472] text-white border-[#B03472]'
                                : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                            } disabled:cursor-not-allowed`}>
                            {t(`roles.${r.key}`, r.key)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Current roles summary */}
                <div className="flex-shrink-0 text-right">
                  {rule.targetRoles.length > 0 ? (
                    <div className="flex flex-col gap-1 items-end">
                      {rule.targetRoles.map((r: string) => (
                        <RoleTag key={r} role={r} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-400">{t('notifications.empty_desc')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAnnounce && <AnnounceModal onClose={() => setShowAnnounce(false)} />}
    </div>
  );
}
