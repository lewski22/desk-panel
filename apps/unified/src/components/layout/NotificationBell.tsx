import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { appApi } from '../../api/client';

// ── Ikony ────────────────────────────────────────────────────────
const BellIcon = ({ hasUnread }: { hasUnread: boolean }) => (
  <svg
    width="20" height="20" viewBox="0 0 24 24"
    fill={hasUnread ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2"
    className={hasUnread ? 'text-[#B53578]' : 'text-zinc-400'}
  >
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

// ── Ikony typów ──────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  GATEWAY_OFFLINE:              '🔴',
  GATEWAY_BACK_ONLINE:          '🟢',
  BEACON_OFFLINE:               '🟠',
  FIRMWARE_UPDATE:              '🆙',
  GATEWAY_RESET_NEEDED:         '⚠️',
  RESERVATION_CHECKIN_MISSED:   '⏰',
  SYSTEM_ANNOUNCEMENT:          '📢',
  GATEWAY_KEY_ROTATION_FAILED:  '🔑',
};

// ── Formatuj czas relatywnie ─────────────────────────────────────
/** Zwraca tytuł/body w języku UI jeśli notifikacja ma meta.translations */
function getLocalized(item: any, field: 'title' | 'body' | 'actionLabel', lang: string): string {
  try {
    const meta = item.meta ? JSON.parse(item.meta) : null;
    const tr   = meta?.translations?.[lang] ?? meta?.translations?.['en'];
    if (tr?.[field]) return tr[field];
  } catch {}
  return item[field] ?? '';
}

function timeAgo(dateStr: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return t('notifications.just_now');
  if (min < 60) return t('notifications.min_ago', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24)   return t('notifications.h_ago', { count: h });
  const d = Math.floor(h / 24);
  return t('notifications.d_ago', { count: d });
}

// ════════════════════════════════════════════════════════════════
export function NotificationBell({ role }: { role: string }) {
  const { t, i18n } = useTranslation();
  const [items,    setItems]    = useState<any[]>([]);
  const [unread,   setUnread]   = useState(0);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Polling count ogni 30s
  const fetchCount = useCallback(async () => {
    try {
      const r = await appApi.notifications.countUnread();
      setUnread(r.count);
    } catch { }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Zamknij klikając poza
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await appApi.notifications.inapp();
      setItems(data);
      setUnread(data.filter((n: any) => !n.read).length);
    } catch { }
    setLoading(false);
  };

  const handleRead = async (id: string) => {
    await appApi.notifications.markRead([id]);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleReadAll = async () => {
    await appApi.notifications.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await appApi.notifications.deleteOne(id);
    const deleted = items.find(n => n.id === id);
    setItems(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.read) setUnread(prev => Math.max(0, prev - 1));
  };

  const handleClick = (item: any) => {
    if (!item.read) handleRead(item.id);
    if (item.actionUrl) {
      setOpen(false);
      navigate(item.actionUrl);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ── */}
      <button
        onClick={openPanel}
        className={`relative p-2 rounded-lg transition-colors ${
          open ? 'bg-zinc-800' : 'hover:bg-zinc-800'
        }`}
        aria-label={unread > 0 ? t('notifications.bell_label_n', { count: unread }) : t('notifications.bell_label')}
      >
        <BellIcon hasUnread={unread > 0} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5
            bg-[#B53578] text-white text-[9px] font-bold rounded-full
            flex items-center justify-center leading-none ring-2 ring-zinc-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50
          bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl
          flex flex-col max-h-[480px] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* @i18n */}<span className="text-white font-semibold text-sm">{t('notifications.bell_label')}</span>
              {unread > 0 && (
                <span className="bg-[#B53578] text-white text-[10px] font-bold
                  px-1.5 py-0.5 rounded-full">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleReadAll}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
                {t('notifications.mark_all')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="py-8 text-center text-zinc-500 text-sm">Ładowanie…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-zinc-500 text-sm">{t('notifications.empty_title')}</p>
              </div>
            )}
            {!loading && items.map(item => (
              <div
                key={item.id}
                onClick={() => handleClick(item)}
                className={`group flex gap-3 px-4 py-3 border-b border-zinc-800/60
                  transition-colors cursor-pointer
                  ${item.read
                    ? 'hover:bg-zinc-800/40'
                    : 'bg-zinc-800/60 hover:bg-zinc-800'
                  }`}
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 pt-1">
                  {!item.read
                    ? <div className="w-2 h-2 rounded-full bg-[#B53578]" />
                    : <div className="w-2 h-2" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm flex-shrink-0">
                        {TYPE_ICON[item.type] ?? '🔔'}
                      </span>
                      <p className={`text-sm truncate font-medium
                        ${item.read ? 'text-zinc-400' : 'text-white'}`}>
                        {getLocalized(item, 'title', i18n.language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                        {timeAgo(item.createdAt, t)}
                      </span>
                      <button
                        onClick={e => handleDelete(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity
                          text-zinc-600 hover:text-zinc-300 p-0.5 rounded">
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
                    {getLocalized(item, 'body', i18n.language)}
                  </p>
                  {item.actionLabel && !item.read && (
                    <span className="text-[11px] text-[#B53578] font-medium mt-1 block">
                      {getLocalized(item, 'actionLabel', i18n.language)} →
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0 text-center">
              <span className="text-[11px] text-zinc-600">
                {t('notifications.footer', { count: items.length })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
