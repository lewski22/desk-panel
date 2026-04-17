/**
 * FloorPlanEditorPage — strona /floor-plan/:locationId
 * Sprint D2f — dostępna dla OFFICE_ADMIN+
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate }     from 'react-router-dom';
import { useTranslation }              from 'react-i18next';
import { appApi }                      from '../api/client';
import { FloorPlanEditor }             from '../components/floor-plan/FloorPlanEditor';
import { Spinner }                     from '../components/ui';

export function FloorPlanEditorPage() {
  const { locationId }  = useParams<{ locationId: string }>();
  const navigate        = useNavigate();
  const { t }           = useTranslation();

  const [desks,    setDesks]    = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    Promise.all([
      appApi.desks.status(locationId),
      appApi.locations.listAll(),
    ])
      .then(([deskRes, locs]) => {
        setDesks(deskRes?.desks ?? deskRes ?? []);
        setLocation(locs.find((l: any) => l.id === locationId) ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) return <Spinner />;

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <p className="text-4xl mb-3">⚠️</p>
      <p className="text-zinc-700 font-semibold">{t('common.error')}</p>
      <p className="text-zinc-400 text-sm mt-1 mb-4">{error}</p>
      <button onClick={() => navigate(-1)}
        className="text-sm text-[#B53578] underline">{t('btn.back')}</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-zinc-600 transition-colors p-1">
          ‹
        </button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">
            {t('floorplan.editor.title')}
          </h1>
          {location && (
            <p className="text-sm text-zinc-400 mt-0.5">{location.name}</p>
          )}
        </div>
        <div className="ml-auto text-xs text-zinc-400 hidden md:block">
          {t('floorplan.editor.hint')}
        </div>
      </div>

      {desks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🪑</span>
          <p className="text-zinc-600 font-semibold mb-1">{t('floorplan.editor.no_desks')}</p>
          <p className="text-zinc-400 text-sm mb-4">{t('floorplan.editor.no_desks_sub')}</p>
          <button onClick={() => navigate('/desks')}
            className="text-sm text-[#B53578] underline">{t('floorplan.editor.go_add_desks')}</button>
        </div>
      ) : (
        <FloorPlanEditor
          locationId={locationId!}
          desks={desks}
          onSaved={() => {
            // Po zapisie odśwież dane
            appApi.desks.status(locationId!)
              .then(res => setDesks(res?.desks ?? res ?? []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
