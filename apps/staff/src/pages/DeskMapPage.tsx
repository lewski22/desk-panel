import React from 'react';
import { useDesks } from '../hooks';
import { DeskMap } from '../components/desks/DeskMap';

function getStoredUserRole(): string {
  try { return JSON.parse(localStorage.getItem('staff_user') ?? 'null')?.role ?? ''; }
  catch { return ''; }
}

export function DeskMapPage() {
  const { desks, loading, error, lastUpdated, refetch } = useDesks();
  const userRole = getStoredUserRole();

  if (loading && desks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-zinc-300">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
          <p className="text-sm">Ładowanie mapy biurek…</p>
        </div>
      </div>
    );
  }

  if (error && desks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-zinc-600 font-medium mb-1">Błąd połączenia</p>
          <p className="text-zinc-400 text-sm mb-4">{error}</p>
          <button onClick={refetch}
            className="text-sm px-4 py-2 rounded-lg bg-[#B53578] text-white hover:bg-[#9d2d66] transition-colors">
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
          <span>⚠</span>
          <span>Problem z połączeniem — dane mogą być nieaktualne</span>
        </div>
      )}
      <DeskMap desks={desks} lastUpdated={lastUpdated} onRefresh={refetch} userRole={userRole} />
    </div>
  );
}
