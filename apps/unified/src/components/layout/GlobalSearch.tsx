import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../../api/client';

interface SearchResult {
  type:  'desk' | 'user' | 'page';
  id:    string;
  title: string;
  sub?:  string;
  url:   string;
  icon:  string;
}

const PAGES: SearchResult[] = [
  { type: 'page', id: 'map',           title: 'Mapa biurek',  url: '/map',           icon: '🗺' },
  { type: 'page', id: 'reservations',  title: 'Rezerwacje',   url: '/reservations',  icon: '📋' },
  { type: 'page', id: 'users',         title: 'Użytkownicy',  url: '/users',         icon: '👥' },
  { type: 'page', id: 'desks',         title: 'Biurka',       url: '/desks',         icon: '🖥' },
  { type: 'page', id: 'reports',       title: 'Raporty',      url: '/reports',       icon: '📊' },
  { type: 'page', id: 'provisioning',  title: 'Provisioning', url: '/provisioning',  icon: '📡' },
  { type: 'page', id: 'organizations', title: 'Biura',        url: '/organizations', icon: '🏢' },
  { type: 'page', id: 'integrations',  title: 'Integracje',   url: '/integrations',  icon: '🔗' },
  { type: 'page', id: 'dashboard',     title: 'Dashboard',    url: '/dashboard',     icon: '📈' },
];

export function GlobalSearch() {
  const { t }             = useTranslation();
  const navigate          = useNavigate();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onCustom = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('reserti:search', onCustom);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('reserti:search', onCustom);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults(PAGES.slice(0, 5));
      setActiveIdx(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(PAGES.slice(0, 5)); return; }
    setLoading(true);
    try {
      const [usersResult, desksResult] = await Promise.allSettled([
        appApi.users.list(),
        Promise.resolve([] as any[]),
      ]);

      const userResults: SearchResult[] = (usersResult.status === 'fulfilled' ? usersResult.value : [])
        .filter((u: any) =>
          `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 4)
        .map((u: any) => ({
          type: 'user' as const,
          id:   u.id,
          title: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
          sub:  u.email,
          url:  '/users',
          icon: '👤',
        }));

      const deskResults: SearchResult[] = (desksResult.status === 'fulfilled' ? desksResult.value : [])
        .filter((d: any) =>
          `${d.name ?? ''} ${d.code ?? ''}`.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 4)
        .map((d: any) => ({
          type: 'desk' as const,
          id:   d.id,
          title: d.name,
          sub:  `kod: ${d.code}${d.floor ? ` · P${d.floor}` : ''}`,
          url:  '/map',
          icon: '🖥',
        }));

      const pageResults = PAGES.filter(p =>
        p.title.toLowerCase().includes(q.toLowerCase())
      );

      setResults([...userResults, ...deskResults, ...pageResults].slice(0, 8));
      setActiveIdx(0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const go = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) go(results[activeIdx].url);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">

        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-zinc-400">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('search.placeholder', 'Szukaj biurek, użytkowników, stron…')}
            className="flex-1 text-sm text-zinc-800 placeholder-zinc-400 outline-none"
          />
          {loading && (
            <div className="w-3 h-3 border border-zinc-200 border-t-brand rounded-full animate-spin shrink-0" />
          )}
          <kbd className="text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5 font-mono shrink-0">Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto py-1.5">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r.url)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === activeIdx ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                }`}
              >
                <span className="text-base w-5 text-center shrink-0">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 truncate">{r.title}</p>
                  {r.sub && <p className="text-xs text-zinc-400 truncate">{r.sub}</p>}
                </div>
                <span className="text-[10px] text-zinc-300 shrink-0 capitalize">{r.type}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-400">
            {t('search.no_results', 'Brak wyników dla „{{q}}"', { q: query })}
          </div>
        )}

        <div className="px-4 py-2 border-t border-zinc-100 flex gap-4 text-[10px] text-zinc-400">
          <span><kbd className="font-mono border border-zinc-200 rounded px-1">↑↓</kbd> nawigacja</span>
          <span><kbd className="font-mono border border-zinc-200 rounded px-1">↵</kbd> otwórz</span>
          <span><kbd className="font-mono border border-zinc-200 rounded px-1">Esc</kbd> zamknij</span>
        </div>
      </div>
    </>
  );
}
