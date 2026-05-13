import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi }      from '../api/client';
import { Btn, Modal, Input, Spinner, EmptyState } from '../components/ui';

// ── Create Modal ──────────────────────────────────────────────
function CreateGroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t }                              = useTranslation();
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setErr(t('parking_groups.create_modal.name_required')); return; }
    setSaving(true); setErr(null);
    try {
      await appApi.parkingGroups.create({ name: name.trim(), description: description.trim() || undefined });
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('parking_groups.create_modal.title')} onClose={onClose}>
      <div className="space-y-4">
        <Input
          label={t('parking_groups.create_modal.name_label')}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('parking_groups.create_modal.name_placeholder')}
          autoFocus
        />
        <Input
          label={t('parking_groups.create_modal.desc_label')}
          value={description}
          onChange={e => setDesc(e.target.value)}
          placeholder={t('parking_groups.create_modal.desc_placeholder')}
        />
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleSave} loading={saving}>{t('parking_groups.create_modal.submit')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function ParkingGroupsPage() {
  const { t }                               = useTranslation();
  const navigate                            = useNavigate();
  const [groups,  setGroups]        = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [err,     setErr]           = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    appApi.parkingGroups.list()
      .then(setGroups)
      .catch(e => setErr(e?.message ?? t('error.load_failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(t('parking_groups.confirm_delete', { name }))) return;
    try {
      await appApi.parkingGroups.remove(id);
      load();
    } catch (e: any) {
      alert(e?.message ?? t('error.load_failed'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">🅿️ {t('parking_groups.page_title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('parking_groups.page_sub')}</p>
        </div>
        <Btn onClick={() => setShowCreate(true)}>{t('parking_groups.new_group')}</Btn>
      </div>

      {err && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>
      )}

      {loading ? <Spinner /> : groups.length === 0 ? (
        <EmptyState
          icon="🅿️"
          title={t('parking_groups.empty_title')}
          sub={t('parking_groups.empty_sub')}
          action={<Btn onClick={() => setShowCreate(true)}>{t('parking_groups.new_group')}</Btn>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.col_name')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('parking_groups.col_description')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.col_users')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.col_parkings')}</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                  <td className="py-3 px-4">
                    <p className="font-medium text-zinc-800">{g.name}</p>
                  </td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">
                    {g.description ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium">
                      👤 {g._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                      🅿️ {g._count?.resources ?? 0}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/parking-groups/${g.id}`)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors font-medium">
                        {t('parking_groups.manage')}
                      </button>
                      <button
                        onClick={() => handleRemove(g.id, g.name)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                        {t('btn.remove')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
