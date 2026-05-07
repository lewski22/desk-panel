/**
 * ResourcesPage — Sprint E2
 * CRUD sal konferencyjnych, miejsc parkingowych i sprzętu
 * Dostępna dla OFFICE_ADMIN+
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate }     from 'react-router-dom';
import { useOrgModules }   from '../hooks/useOrgModules';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../api/client';
import {
  Btn, Card, Modal, Input, Select, FormField,
  Spinner, EmptyState, PageHeader,
} from '../components/ui';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { toast } from '../components/ui/Toast';
import type { Resource } from '../types/api';

const RESOURCE_TYPES = ['ROOM', 'PARKING', 'EQUIPMENT'] as const;

const TYPE_ICONS: Record<string, string> = {
  ROOM: '🏛', PARKING: '🅿️', EQUIPMENT: '🔧',
};

const PRESET_AMENITIES = ['TV','whiteboard','videoconf','projector','phone','ac'];

// ── Form Modal ────────────────────────────────────────────────
function ResourceModal({ resource, locationId, allAmenities, onClose, onSaved, onAddAmenity }: {
  resource?: Resource; locationId: string; allAmenities: string[];
  onClose: () => void; onSaved: () => void;
  onAddAmenity: (tag: string) => void;
}) {
  const { t }   = useTranslation();
  const isEdit  = !!resource;

  const [form, setForm] = useState({
    type:        resource?.type        ?? 'ROOM',
    name:        resource?.name        ?? '',
    code:        resource?.code        ?? '',
    description: resource?.description ?? '',
    capacity:    resource?.capacity    ?? '',
    vehicleType: resource?.vehicleType ?? 'car',
    floor:       resource?.floor       ?? '',
    zone:        resource?.zone        ?? '',
    amenities:   resource?.amenities   ?? [] as string[],
  });
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [isDirty,     setIsDirty]     = useState(false);
  const [showGuard,   setShowGuard]   = useState(false);
  const [customInput, setCustomInput] = useState('');

  const set = (k: string, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  const toggleAmenity = (a: string) => {
    setIsDirty(true);
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x: string) => x !== a)
        : [...f.amenities, a],
    }));
  };

  const handleAddCustom = () => {
    const tag = customInput.trim().toLowerCase();
    if (!tag) return;
    onAddAmenity(tag);
    if (!form.amenities.includes(tag)) {
      setForm(f => ({ ...f, amenities: [...f.amenities, tag] }));
      setIsDirty(true);
    }
    setCustomInput('');
  };

  const requestClose = () => {
    if (isDirty) setShowGuard(true);
    else onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setErr(t('resource.form.required')); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        vehicleType: form.type === 'PARKING' ? form.vehicleType : undefined,
        amenities: form.type === 'ROOM' ? form.amenities : [],
      };
      if (isEdit) await appApi.resources.update(resource.id, payload);
      else        await appApi.resources.create(locationId, payload);
      setIsDirty(false);
      onSaved();
    } catch (e: any) {
      console.error('[ResourceModal] save failed', e);
      setErr(e?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal title={isEdit ? t('resource.edit_title', { name: resource.name }) : t('resource.create_title')} onClose={requestClose}>
      <div className="space-y-4">
        <FormField label={t('resource.form.type')}>
          <Select value={form.type} onChange={e => set('type', e.target.value)}>
            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('resource.form.name')} value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Sala Alpha" />
          <Input label={t('resource.form.code')} value={form.code}
            onChange={e => set('code', e.target.value)} placeholder="ROOM-A01" />
        </div>

        <Input label={t('resource.form.description')} value={form.description}
          onChange={e => set('description', e.target.value)} />

        {form.type === 'ROOM' && (
          <>
            <Input label={t('resource.form.capacity')} type="number" value={form.capacity}
              onChange={e => set('capacity', e.target.value)} placeholder="10" />
            <FormField label={t('resource.form.amenities')}>
              <div className="flex flex-wrap gap-2 mt-1">
                {allAmenities.map(a => (
                  <button key={a} type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.amenities.includes(a)
                        ? 'bg-violet-500 text-white border-violet-500'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
                  placeholder={t('resource.form.amenity_placeholder', 'Dodaj własne…')}
                  className="flex-1 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-violet-400"
                />
                <button type="button" onClick={handleAddCustom}
                  className="text-xs px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition-colors">
                  {t('resource.form.amenity_add', '+ Dodaj')}
                </button>
              </div>
            </FormField>
          </>
        )}

        {form.type === 'PARKING' && (
          <FormField label={t('resource.form.vehicle_type')}>
            <Select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
              <option value="car">🚗 {t('resource.vehicle.car')}</option>
              <option value="moto">🏍 {t('resource.vehicle.moto')}</option>
              <option value="bike">🚲 {t('resource.vehicle.bike')}</option>
            </Select>
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('desks.form.label.floor')} value={form.floor}
            onChange={e => set('floor', e.target.value)} placeholder="2" />
          <Input label={t('desks.form.label.zone')} value={form.zone}
            onChange={e => set('zone', e.target.value)} placeholder="A" />
        </div>

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={requestClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleSave} loading={saving}>{t('btn.save')}</Btn>
        </div>
      </div>
    </Modal>

    {showGuard && (
      <DirtyGuardDialog
        onConfirm={() => { setShowGuard(false); onClose(); }}
        onCancel={() => setShowGuard(false)}
      />
    )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function ResourcesPage() {
  const { t }         = useTranslation();
  const navigate      = useNavigate();
  const { isEnabled } = useOrgModules();

  // Jeśli oba moduły wyłączone — przekieruj
  const canAccess = isEnabled('ROOMS') || isEnabled('PARKING') || isEnabled('DESKS');
  if (!canAccess) {
    navigate('/dashboard');
    return null;
  }

  // Filtruj typy zasobów do tych które są włączone
  const availableTypes = (['ROOM', 'PARKING', 'EQUIPMENT'] as const).filter(type => {
    if (type === 'ROOM')    return isEnabled('ROOMS');
    if (type === 'PARKING') return isEnabled('PARKING');
    return true; // EQUIPMENT zawsze dostępne gdy jest ResourcesPage
  });

  const [locations, setLocations]     = useState<any[]>([]);
  const [locationId, setLocId]        = useState('');
  const [resources, setResources]     = useState<Resource[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState<'create' | Resource | null>(null);
  const [typeFilter, setType]         = useState('');
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);

  const allAmenities = useMemo(
    () => [...new Set([...PRESET_AMENITIES, ...customAmenities])],
    [customAmenities],
  );

  const addCustomAmenity = useCallback((tag: string) => {
    setCustomAmenities(prev => {
      if (prev.includes(tag)) return prev;
      const next = [...prev, tag];
      appApi.organizations.updateAmenities(next).catch(() => {
        setCustomAmenities(rollback => rollback.filter(a => a !== tag));
      });
      return next;
    });
  }, []);

  useEffect(() => {
    appApi.organizations.getAmenities()
      .then(setCustomAmenities)
      .catch(() => {});
    appApi.locations.listAll()
      .then(locs => { setLocations(locs); if (locs.length > 0) setLocId(locs[0].id); })
      .catch(() => {});
  }, []);

  const load = () => {
    if (!locationId) return;
    setLoading(true);
    appApi.resources.list(locationId, typeFilter || undefined)
      .then(setResources)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId, typeFilter]);

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(t('resource.confirm_remove', { name }))) return;
    await appApi.resources.remove(id);
    load();
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of resources) {
      if (!g[r.type]) g[r.type] = [];
      g[r.type].push(r);
    }
    return g;
  }, [resources]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('resource.page_title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('resource.page_sub')}</p>
        </div>
        <Btn onClick={() => setModal('create')}>+ {t('resource.add')}</Btn>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {locations.length > 1 && (
          <select value={locationId} onChange={e => setLocId(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          {['', ...RESOURCE_TYPES].map(type => (
            <button key={type} onClick={() => setType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === type ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {type ? `${TYPE_ICONS[type]} ${type}` : t('reservations.filter.all')}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : resources.length === 0 ? (
        <EmptyState icon="🏛" title={t('resource.empty_title')} sub={t('resource.empty_sub')}
          action={<Btn onClick={() => setModal('create')}>+ {t('resource.add')}</Btn>} />
      ) : (
        Object.entries(grouped).map(([type, list]) => (
          <div key={type} className="mb-6">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              {TYPE_ICONS[type]} {type} · {list.length}
            </p>
            <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('resource.table.name')}</th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('resource.table.details')}</th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">{t('resource.table.location')}</th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('resource.table.status')}</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-800">{r.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">{r.code}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                        {r.capacity && <span>👤 {r.capacity} · </span>}
                        {r.vehicleType && <span>{r.vehicleType} · </span>}
                        {r.amenities?.join(', ')}
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-500 hidden md:table-cell">
                        {[r.zone, r.floor && `Piętro ${r.floor}`].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                        }`}>{r.status === 'ACTIVE' ? t('resource.status.active') : t('resource.status.inactive')}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal(r)}
                            className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
                            {t('users.actions.edit')}
                          </button>
                          <button onClick={() => handleRemove(r.id, r.name)}
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
          </div>
        ))
      )}

      {modal && (
        <ResourceModal
          resource={modal === 'create' ? undefined : modal}
          locationId={locationId}
          allAmenities={allAmenities}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); toast(t('toast.resource_saved', 'Zasób zapisano')); load(); }}
          onAddAmenity={addCustomAmenity}
        />
      )}
    </div>
  );
}
