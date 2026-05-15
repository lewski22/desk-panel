/**
 * ResourcesPage — Sprint E2 (DS 0.19)
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
import { ParkingQrModal } from '../components/resources/ParkingQrModal';
import { toast } from '../components/ui/Toast';
import type { Resource } from '../types/api';

// ── AddBlockModal (dla pojedynczego miejsca) ──────────────────
function AddResourceBlockModal({ resourceId, onClose, onSaved }: {
  resourceId: string; onClose: () => void; onSaved: () => void;
}) {
  const [startTime, setStart]  = useState('');
  const [endTime,   setEnd]    = useState('');
  const [reason,    setReason] = useState('');
  const [saving,    setSaving] = useState(false);
  const [err,       setErr]    = useState<string | null>(null);

  const handleSave = async () => {
    if (!startTime || !endTime) { setErr('Podaj czas początku i końca'); return; }
    if (new Date(startTime) >= new Date(endTime)) { setErr('Czas końca musi być po czasie początku'); return; }
    setSaving(true); setErr(null);
    try {
      await appApi.parkingBlocks.create({ resourceId, startTime, endTime, reason: reason.trim() || undefined });
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Zablokuj miejsce parkingowe" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Od" type="datetime-local" value={startTime} onChange={e => setStart(e.target.value)} />
          <Input label="Do" type="datetime-local" value={endTime}   onChange={e => setEnd(e.target.value)} />
        </div>
        <Input label="Powód (opcjonalnie)" value={reason} onChange={e => setReason(e.target.value)} placeholder="np. Remont" />
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
          <Btn onClick={handleSave} loading={saving}>Zablokuj</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── ResourceBlocksSection ─────────────────────────────────────
function ResourceBlocksSection({ resourceId, defaultExpanded }: {
  resourceId: string;
  defaultExpanded?: boolean;
}) {
  const [blocks,   setBlocks]   = useState<any[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [loading,  setLoading]  = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    appApi.parkingBlocks.list({ resourceId })
      .then(setBlocks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId]);

  useEffect(() => {
    if (defaultExpanded) load();
  }, [defaultExpanded, load]);

  const handleExpand = () => {
    if (!expanded) load();
    setExpanded(e => !e);
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Usunąć blokadę?')) return;
    try { await appApi.parkingBlocks.remove(id); load(); }
    catch (e: any) { alert((e as any)?.message ?? 'Błąd'); }
  };

  const fmt = (d: string) => new Date(d).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

  const blocksContent = (
    <div className={defaultExpanded ? '' : 'mt-2 pl-2 border-l-2 border-zinc-100'}>
      {loading ? (
        <div className="w-4 h-4 border-2 border-zinc-200 border-t-violet-400 rounded-full animate-spin my-2" />
      ) : blocks.length === 0 ? (
        <p className="text-xs text-zinc-400 py-1">Brak blokad</p>
      ) : (
        <div className="space-y-1">
          {blocks.map(b => (
            <div key={b.id} className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="text-red-500">⛔</span>
              <span>{fmt(b.startTime)} – {fmt(b.endTime)}</span>
              {b.reason && <span className="text-zinc-400">· {b.reason}</span>}
              <button onClick={() => handleRemove(b.id)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowAdd(true)}
        className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
        + Zablokuj miejsce
      </button>
    </div>
  );

  return (
    <div className={defaultExpanded ? '' : 'mt-2'}>
      {!defaultExpanded && (
        <button
          onClick={handleExpand}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors group"
        >
          <span className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>▸</span>
          <span className="group-hover:underline underline-offset-2">Blokady miejsca</span>
          {blocks.length > 0 && !loading && (
            <span className="bg-red-100 text-red-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none">
              {blocks.length}
            </span>
          )}
        </button>
      )}
      {(expanded || defaultExpanded) && blocksContent}
      {showAdd && (
        <AddResourceBlockModal
          resourceId={resourceId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

const RESOURCE_TYPES = ['ROOM', 'PARKING', 'EQUIPMENT'] as const;
const TYPE_ORDER     = ['ROOM', 'PARKING', 'EQUIPMENT'] as const;

const PRESET_AMENITIES = ['TV','whiteboard','videoconf','projector','phone','ac'];

// ── Form Modal ────────────────────────────────────────────────
function ResourceModal({ resource, locationId, allAmenities, onClose, onSaved, onAddAmenity }: {
  resource?: Resource; locationId: string; allAmenities: string[];
  onClose: () => void; onSaved: () => void;
  onAddAmenity: (tag: string) => void;
}) {
  const { t }   = useTranslation();
  const isEdit  = !!resource;

  const TYPE_ICONS: Record<string, string> = { ROOM: '🏛', PARKING: '🅿️', EQUIPMENT: '🔧' };

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
    notes:       (resource as any)?.notes ?? '',
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
      const { type, code, ...rest } = form;
      const shared = {
        ...rest,
        capacity:    form.capacity ? Number(form.capacity) : undefined,
        vehicleType: form.type === 'PARKING' ? form.vehicleType : undefined,
        amenities:   form.type === 'ROOM'    ? form.amenities   : [],
        notes:       form.type === 'PARKING' ? (form.notes.trim() || undefined) : undefined,
      };
      if (isEdit) await appApi.resources.update(resource.id, shared);
      else        await appApi.resources.create(locationId, { type, code, ...shared });
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
            {RESOURCE_TYPES.map(tp => <option key={tp} value={tp}>{TYPE_ICONS[tp]} {tp}</option>)}
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
          <>
            <FormField label={t('resource.form.vehicle_type')}>
              <Select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
                <option value="car">🚗 {t('resource.vehicle.car')}</option>
                <option value="moto">🏍 {t('resource.vehicle.moto')}</option>
                <option value="bike">🚲 {t('resource.vehicle.bike')}</option>
              </Select>
            </FormField>
            <Input label={t('resource.form.notes', 'Notatki')} value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder={t('resource.form.notes_placeholder', 'np. Tylko dla pojazdów elektrycznych')} />
          </>
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

  const canAccess = isEnabled('ROOMS') || isEnabled('PARKING') || isEnabled('DESKS');
  if (!canAccess) {
    navigate('/dashboard');
    return null;
  }

  const availableTypes = (['ROOM', 'PARKING', 'EQUIPMENT'] as const).filter(type => {
    if (type === 'ROOM')    return isEnabled('ROOMS');
    if (type === 'PARKING') return isEnabled('PARKING');
    return true;
  });

  // TYPE_META inside component — needs t() access
  const TYPE_META: Record<string, {
    icon: string; iconColor: string; iconBg: string;
    labelPl: string; sectionPl: string; addLabel: string;
  }> = {
    ROOM: {
      icon:      'building-community',
      iconColor: '#16A34A',
      iconBg:    '#F0FDF4',
      labelPl:   t('resource.type_label.room',      'Sale'),
      sectionPl: t('resource.section.room',          'Sale konferencyjne'),
      addLabel:  t('resource.add_type.room',         'Dodaj salę'),
    },
    PARKING: {
      icon:      'parking',
      iconColor: '#1D4ED8',
      iconBg:    '#EFF6FF',
      labelPl:   t('resource.type_label.parking',   'Parking'),
      sectionPl: t('resource.section.parking',       'Parking'),
      addLabel:  t('resource.add_type.parking',      'Dodaj miejsce'),
    },
    EQUIPMENT: {
      icon:      'tool',
      iconColor: '#D97706',
      iconBg:    '#FFFBEB',
      labelPl:   t('resource.type_label.equipment', 'Sprzęt'),
      sectionPl: t('resource.section.equipment',     'Sprzęt i wyposażenie'),
      addLabel:  t('resource.add_type.equipment',    'Dodaj sprzęt'),
    },
  };

  // ── State ──
  const [locations, setLocations]             = useState<any[]>([]);
  const [locationId, setLocId]                = useState('');
  const [resources, setResources]             = useState<Resource[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [modal, setModal]                     = useState<'create' | null>(null);
  const [editTarget, setEditTarget]           = useState<any | null>(null);
  const [qrModalResource, setQrModalResource] = useState<Resource | null>(null);
  const [typeFilter, setType]                 = useState('');
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [expandedId, setExpandedId]           = useState<string | null>(null);

  function toggleBlockades(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

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
    try {
      await appApi.resources.remove(id);
      load();
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes('409') || e?.message?.toLowerCase().includes('booking')) {
        toast(t('resource.remove_conflict', 'Nie można usunąć — zasób ma aktywne rezerwacje'), 'error');
      } else {
        toast(e?.message ?? t('common.error'), 'error');
      }
    }
  };

  const handleDelete = (r: any) => handleRemove(r.id, r.name);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of resources) {
      if (!g[r.type]) g[r.type] = [];
      g[r.type].push(r);
    }
    return g;
  }, [resources]);

  const orderedEntries = TYPE_ORDER
    .filter(type => grouped[type])
    .map(type => [type, grouped[type]] as [string, any[]]);

  return (
    <div>
      {/* Page header */}
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
        <div className="flex flex-wrap gap-1 bg-zinc-100 rounded-xl p-1">
          {(['', ...availableTypes] as string[]).map(type => (
            <button
              key={type || 'all'}
              onClick={() => setType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                typeFilter === type
                  ? 'bg-[#FDF4F9] border-[#B53578] text-[#B53578]'
                  : 'bg-white border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC]'
              }`}
            >
              {type && TYPE_META[type] && (
                <i className={`ti ti-${TYPE_META[type].icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
              )}
              {type ? (TYPE_META[type]?.labelPl ?? type) : t('reservations.filter.all', 'Wszystkie')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? <Spinner /> : resources.length === 0 ? (
        // TODO: EmptyState may not support ReactNode in icon prop — using emoji fallback
        <EmptyState
          icon="🏛"
          title={t('resource.empty_title')}
          sub={t('resource.empty_sub')}
          action={<Btn onClick={() => setModal('create')}>+ {t('resource.add')}</Btn>}
        />
      ) : (
        orderedEntries.map(([type, list]) => {
          const meta = TYPE_META[type];
          if (!meta) return null;
          return (
            <div key={type} className="mb-6 overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">

              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-zinc-100">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: meta.iconBg }}
                >
                  <i
                    className={`ti ti-${meta.icon}`}
                    style={{ fontSize: 13, color: meta.iconColor }}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-xs font-semibold text-zinc-700 font-['Sora']">
                  {meta.sectionPl}
                </span>
                <span className="text-xs text-zinc-400 ml-0.5">· {list.length}</span>
                <button
                  onClick={() => setModal('create')}
                  className="ml-auto text-xs text-[#B53578] hover:underline flex items-center gap-1"
                >
                  <i className="ti ti-plus" style={{ fontSize: 11 }} aria-hidden="true" />
                  {meta.addLabel}
                </button>
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }} className="py-2.5 px-4 text-left text-[10px] text-zinc-400 font-semibold uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                      {t('resource.table.name')}
                    </th>
                    <th style={{ width: '30%' }} className="py-2.5 px-4 text-left text-[10px] text-zinc-400 font-semibold uppercase tracking-wider bg-zinc-50 border-b border-zinc-100 hidden sm:table-cell">
                      {t('resource.table.details')}
                    </th>
                    <th style={{ width: '22%' }} className="py-2.5 px-4 text-left text-[10px] text-zinc-400 font-semibold uppercase tracking-wider bg-zinc-50 border-b border-zinc-100 hidden md:table-cell">
                      {t('resource.table.location')}
                    </th>
                    <th style={{ width: '12%' }} className="py-2.5 px-4 text-left text-[10px] text-zinc-400 font-semibold uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                      {t('resource.table.status')}
                    </th>
                    <th style={{ width: '6%' }} className="py-2.5 px-4 bg-zinc-50 border-b border-zinc-100" />
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <React.Fragment key={r.id}>
                      <tr className="border-b border-zinc-50 hover:bg-zinc-50/60">

                        {/* Name */}
                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-800 text-sm">{r.name}</p>
                          <p className="text-[10px] text-zinc-400">{r.code}</p>
                          {r.type === 'PARKING' && r.groups && r.groups.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.groups.map((g: any) => (
                                <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 font-medium">
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {r.type === 'PARKING' && (
                            <button
                              className="text-[10px] text-[#B53578] mt-1 flex items-center gap-1 hover:underline"
                              onClick={() => toggleBlockades(r.id)}
                            >
                              <i
                                className={`ti ti-chevron-${expandedId === r.id ? 'down' : 'right'}`}
                                style={{ fontSize: 10 }}
                                aria-hidden="true"
                              />
                              {t('resource.blockades', 'Blokady miejsca')}
                            </button>
                          )}
                        </td>

                        {/* Details — chip tags, no trailing dot */}
                        <td className="py-3 px-4 hidden sm:table-cell">
                          {(() => {
                            const parts: React.ReactNode[] = [];
                            if (r.capacity) parts.push(
                              <span key="cap" className="inline-flex items-center gap-1 bg-zinc-100 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-600">
                                <i className="ti ti-users" style={{ fontSize: 11 }} aria-hidden="true" />
                                {r.capacity}
                              </span>
                            );
                            if (r.vehicleType) parts.push(
                              <span key="veh" className="inline-flex items-center gap-1 bg-zinc-100 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-600">
                                <i
                                  className={`ti ti-${
                                    r.vehicleType === 'car'  ? 'car'
                                    : r.vehicleType === 'moto' ? 'motorbike'
                                    : 'bike'
                                  }`}
                                  style={{ fontSize: 11 }}
                                  aria-hidden="true"
                                />
                                {t(`resource.vehicle.${r.vehicleType}`, r.vehicleType)}
                              </span>
                            );
                            r.amenities?.forEach((a: string) => parts.push(
                              <span key={a} className="inline-flex items-center gap-1 bg-zinc-100 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-600">
                                {a}
                              </span>
                            ));
                            return parts.length > 0
                              ? <div className="flex flex-wrap gap-1">{parts}</div>
                              : <span className="text-[11px] text-zinc-300">—</span>;
                          })()}
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4 text-xs text-zinc-500 hidden md:table-cell">
                          {[r.zone, r.floor && `Piętro ${r.floor}`].filter(Boolean).join(' · ') || '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              r.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}>
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: r.status === 'ACTIVE' ? '#10B981' : '#A1A1AA' }}
                              />
                              {r.status === 'ACTIVE' ? t('resource.status.active') : t('resource.status.inactive')}
                            </span>
                            {r.type === 'PARKING' && r.accessMode && (
                              <span
                                title={r.accessMode === 'GROUP_RESTRICTED'
                                  ? 'Miejsce dostępne tylko dla wybranych grup'
                                  : undefined}
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                  r.accessMode === 'GROUP_RESTRICTED'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}
                              >
                                <i
                                  className={`ti ${r.accessMode === 'GROUP_RESTRICTED' ? 'ti-users-group' : 'ti-world'}`}
                                  style={{ fontSize: 10 }}
                                  aria-hidden="true"
                                />
                                {r.accessMode === 'GROUP_RESTRICTED'
                                  ? t('resource.access.group_only', 'Tylko grupy')
                                  : t('resource.access.public', 'Publiczne')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions — always visible */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            {r.type === 'PARKING' && r.qrToken && (
                              <button
                                onClick={() => setQrModalResource(r)}
                                className="w-7 h-7 flex items-center justify-center rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700 transition-colors"
                                title="Kod QR miejsca parkingowego"
                              >
                                <i className="ti ti-qrcode" style={{ fontSize: 14 }} aria-hidden="true" />
                              </button>
                            )}
                            <button
                              onClick={() => setEditTarget(r)}
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700 transition-colors"
                              title={t('users.actions.edit', 'Edytuj')}
                            >
                              <i className="ti ti-edit" style={{ fontSize: 14 }} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-red-100 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              title={t('btn.remove', 'Usuń')}
                            >
                              <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Blockades expanded row */}
                      {r.type === 'PARKING' && expandedId === r.id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 bg-zinc-50/70 border-b border-zinc-100">
                            <ResourceBlocksSection resourceId={r.id} defaultExpanded />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {/* Create modal */}
      {modal === 'create' && (
        <ResourceModal
          locationId={locationId}
          allAmenities={allAmenities}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); toast(t('toast.resource_saved', 'Zasób zapisano')); load(); }}
          onAddAmenity={addCustomAmenity}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <ResourceModal
          resource={editTarget}
          locationId={locationId}
          allAmenities={allAmenities}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); toast(t('toast.resource_saved', 'Zasób zapisano')); load(); }}
          onAddAmenity={addCustomAmenity}
        />
      )}

      {qrModalResource && (
        <ParkingQrModal resource={qrModalResource} onClose={() => setQrModalResource(null)} />
      )}
    </div>
  );
}
