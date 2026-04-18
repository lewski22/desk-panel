/**
 * CalendarSyncSection — sekcja "Synchronizacja kalendarza" w profilu usera.
 *
 * Umieść w:
 *   - apps/unified/src/pages/ProfilePage.tsx (zakładka "Kalendarze")
 *   - LUB apps/unified/src/pages/SettingsPage.tsx
 *
 * apps/unified/src/components/calendar/CalendarSyncSection.tsx
 */
import { useState, useEffect } from 'react';
import { useTranslation }       from 'react-i18next';
import { appApi }               from '../../api/client';

interface GraphStatus {
  connected:  boolean;
  tokenValid?: boolean;
}

export function CalendarSyncSection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const [status,        setStatus]        = useState<GraphStatus | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [flashMsg,      setFlashMsg]      = useState('');
  const [flashType,     setFlashType]     = useState<'success' | 'error'>('success');

  const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1';

  useEffect(() => {
    // Obsługa powrotu z OAuth Microsoft
    const params = new URLSearchParams(window.location.search);

    if (params.get('graph_connected') === '1') {
      setFlashMsg(lang === 'pl' ? 'Outlook Calendar został połączony. Rezerwacje będą teraz synchronizowane.' : 'Outlook Calendar connected. Reservations will now be synced.');
      setFlashType('success');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('graph_error')) {
      const errMsg = decodeURIComponent(params.get('graph_error') ?? '');
      setFlashMsg((lang === 'pl' ? 'Nie udało się połączyć: ' : 'Failed to connect: ') + errMsg);
      setFlashType('error');
      window.history.replaceState({}, '', window.location.pathname);
    }

    appApi.graph.status()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const connect = () => {
    // Redirect do OAuth — powróci z ?graph_connected=1 lub ?graph_error=
    window.location.href = `${API_URL}/auth/graph/redirect`;
  };

  const reconnect = () => {
    // Re-authorize — wymusi nowy consent screen
    window.location.href = `${API_URL}/auth/graph/redirect`;
  };

  const disconnect = async () => {
    if (!window.confirm(lang === 'pl'
      ? 'Odłączyć Outlook Calendar? Rezerwacje przestaną być synchronizowane.'
      : 'Disconnect Outlook Calendar? Reservations will stop syncing.')) return;

    setDisconnecting(true);
    try {
      await appApi.graph.disconnect();
      setStatus({ connected: false });
      setFlashMsg(lang === 'pl' ? 'Outlook Calendar odłączony.' : 'Outlook Calendar disconnected.');
      setFlashType('success');
    } catch {
      setFlashMsg(lang === 'pl' ? 'Błąd rozłączania.' : 'Disconnect failed.');
      setFlashType('error');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div style={card}>
      {/* Nagłówek sekcji */}
      <div style={sectionHeader}>
        <div>
          <h3 style={sectionTitle}>
            {lang === 'pl' ? '📅 Synchronizacja kalendarza' : '📅 Calendar sync'}
          </h3>
          <p style={sectionDesc}>
            {lang === 'pl'
              ? 'Połącz Outlook Calendar aby rezerwacje automatycznie pojawiały się w Twoim kalendarzu.'
              : 'Connect Outlook Calendar so reservations automatically appear in your calendar.'}
          </p>
        </div>
      </div>

      {/* Flash message */}
      {flashMsg && (
        <div style={{
          ...flashBase,
          background: flashType === 'success' ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          color:      flashType === 'success' ? 'var(--color-text-success)' : 'var(--color-text-danger)',
          border:     `0.5px solid ${flashType === 'success' ? 'var(--color-border-success)' : 'var(--color-border-danger)'}`,
        }}>
          {flashMsg}
          <button onClick={() => setFlashMsg('')} style={closeBtn}>×</button>
        </div>
      )}

      {/* Microsoft Outlook Card */}
      <div style={providerCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {/* MS Logo */}
          <svg width="28" height="28" viewBox="0 0 23 23" style={{ flexShrink: 0 }}>
            <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
            <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
            <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
            <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
          </svg>

          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
              Outlook Calendar
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {loading ? (lang === 'pl' ? 'Sprawdzanie...' : 'Checking...') :
               status?.connected && status.tokenValid !== false
                ? (lang === 'pl' ? '✓ Połączono — synchronizacja aktywna' : '✓ Connected — sync active')
                : status?.connected
                ? (lang === 'pl' ? '⚠ Połączono — token wygasł, kliknij Odnów' : '⚠ Connected — token expired, click Renew')
                : (lang === 'pl' ? 'Nie połączono' : 'Not connected')}
            </p>
          </div>
        </div>

        {/* Status dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: loading ? 'var(--color-border-secondary)' :
                      status?.connected && status.tokenValid !== false ? 'var(--color-text-success)' :
                      status?.connected ? 'var(--color-text-warning)' : 'var(--color-text-tertiary)',
        }} />

        {/* Akcje */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!loading && (
            status?.connected ? (
              <>
                <button onClick={reconnect} style={btnSecondary}
                  title={lang === 'pl' ? 'Odnów autoryzację' : 'Re-authorize'}>
                  ↻ {lang === 'pl' ? 'Odnów' : 'Renew'}
                </button>
                <button onClick={disconnect} disabled={disconnecting} style={{ ...btnSecondary, color: 'var(--color-text-danger)' }}>
                  {disconnecting ? '…' : (lang === 'pl' ? 'Odłącz' : 'Disconnect')}
                </button>
              </>
            ) : (
              <button onClick={connect} style={btnPrimary}>
                {lang === 'pl' ? 'Połącz' : 'Connect'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Info — co jest synchronizowane */}
      {status?.connected && (
        <div style={infoBox}>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {lang === 'pl'
              ? '• Nowe rezerwacje automatycznie pojawiają się w kalendarzu Outlook\n• Anulowanie rezerwacji usuwa event z kalendarza\n• Zmiany godzin w Outlook są synchronizowane do Reserti'
              : '• New reservations automatically appear in Outlook Calendar\n• Cancelled reservations remove the calendar event\n• Time changes in Outlook are synced back to Reserti'}
          </p>
        </div>
      )}

      {/* Informacja dla użytkowników bez Azure SSO */}
      {!loading && !status?.connected && (
        <div style={infoBox}>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {lang === 'pl'
              ? 'Wymaga: konto Microsoft 365 w domenie firmowej + integracja Azure skonfigurowana przez administratora.'
              : 'Requires: Microsoft 365 account in company domain + Azure integration configured by admin.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Style ─────────────────────────────────────────────────────
const card: React.CSSProperties = {
  border:       '0.5px solid var(--color-border-tertiary)',
  borderRadius: 12,
  padding:      '20px 16px',
  background:   'var(--color-background-primary)',
};
const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4,
};
const sectionDesc: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5,
};
const flashBase: React.CSSProperties = {
  borderRadius: 8, padding: '10px 14px', marginBottom: 14,
  fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
};
const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6, flexShrink: 0,
};
const providerCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 14px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 10, marginBottom: 12,
};
const btnPrimary: React.CSSProperties = {
  fontSize: 13, padding: '6px 16px', borderRadius: 8,
  border: 'none', background: '#0078d4', color: '#fff', cursor: 'pointer', fontWeight: 500,
};
const btnSecondary: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 8,
  border: '0.5px solid var(--color-border-secondary)',
  background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
};
const infoBox: React.CSSProperties = {
  background: 'var(--color-background-secondary)',
  borderRadius: 8, padding: '10px 12px',
  whiteSpace: 'pre-line' as const,
};
