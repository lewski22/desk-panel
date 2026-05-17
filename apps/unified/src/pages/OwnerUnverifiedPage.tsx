import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader } from '../components/ui';

export function OwnerUnverifiedPage() {
  const { t } = useTranslation();
  const [accounts,   setAccounts]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await appApi.owner.getUnverifiedAccounts();
      setAccounts(data);
    } catch (err) {
      console.warn('OwnerUnverifiedPage: load failed', err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (u: any) => {
    if (!confirm(`Usunąć konto ${u.email}?`)) return;
    setDeletingId(u.id);
    try {
      await appApi.owner.deleteUnverifiedAccount(u.id);
      setAccounts(prev => prev.filter(x => x.id !== u.id));
    } catch (e: any) {
      alert(e.message ?? 'Błąd usuwania');
    }
    setDeletingId(null);
  };

  return (
    <div>
      <PageHeader
        title={t('layout.nav.owner_unverified')}
        subtitle="Konta oczekujące na potwierdzenie adresu email"
        action={
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50"
          >
            ↺ Odśwież
          </button>
        }
      />

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">Ładowanie…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm">Brak kont oczekujących na weryfikację</p>
        </div>
      ) : (
        <div className="bg-white overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="py-2.5 px-4 text-left">Email</th>
                <th className="py-2.5 px-4 text-left">Organizacja</th>
                <th className="py-2.5 px-4 text-left">Plan</th>
                <th className="py-2.5 px-4 text-left">Wiek</th>
                <th className="py-2.5 px-4 text-left">Status</th>
                <th className="py-2.5 px-4 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {accounts.map(u => (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-zinc-800">{u.email}</div>
                    <div className="text-xs text-zinc-400">{u.firstName} {u.lastName}</div>
                  </td>
                  <td className="py-3 px-4 text-zinc-600">{u.organization?.name ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                      {u.organization?.plan ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-500">{u.ageHours < 1 ? '< 1h' : `${u.ageHours}h`}</td>
                  <td className="py-3 px-4">
                    {u.isExpired
                      ? <span className="text-xs text-red-600 font-medium">⚠ Link wygasł</span>
                      : <span className="text-xs text-amber-600 font-medium">⏳ Oczekuje</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium disabled:opacity-50 transition-colors"
                    >
                      {deletingId === u.id ? '…' : 'Usuń'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
