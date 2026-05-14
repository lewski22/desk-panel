import React, { useState, useRef } from 'react';

interface Props {
  resource: {
    id: string;
    name: string;
    code: string;
    qrToken?: string | null;
    floor?: string | null;
    zone?: string | null;
    location?: { name?: string };
  };
  onClose: () => void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ParkingQrModal({ resource, onClose }: Props) {
  const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;
  const qrUrl   = resource.qrToken
    ? `${APP_URL}/parking-checkin/${resource.qrToken}`
    : null;

  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const copy = async () => {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const print = () => {
    if (!qrUrl) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR — ${esc(resource.code)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; background: #fff; padding: 24px; }
    .card { border: 2px dashed #d4d4d8; border-radius: 16px;
            padding: 32px 24px; text-align: center; width: 100%; max-width: 320px; }
    .badge { display: inline-flex; align-items: center; gap: 6px;
             background: #f4f4f5; border-radius: 999px;
             padding: 4px 12px; font-size: 12px; color: #52525b; margin-bottom: 16px; }
    .name  { font-size: 22px; font-weight: 700; color: #18181b; margin-bottom: 4px; }
    .meta  { font-size: 12px; color: #71717a; margin-bottom: 24px; line-height: 1.6; }
    .qr    { width: 200px; height: 200px; margin: 0 auto 24px; display: block; }
    .hint  { font-size: 11px; color: #a1a1aa; line-height: 1.6; margin-bottom: 16px; }
    .brand { font-size: 13px; color: #B53578; font-weight: 700; letter-spacing: -0.3px; }
    @media print { @page { margin: 0; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🅿️ Miejsce parkingowe</div>
    <div class="name">${esc(resource.name)}</div>
    <div class="meta">
      ${esc(resource.code)}
      ${resource.location?.name ? '<br>' + esc(resource.location.name) : ''}
      ${resource.floor ? '<br>Piętro: ' + esc(resource.floor) : ''}
      ${resource.zone ? '&nbsp;·&nbsp;Strefa: ' + esc(resource.zone) : ''}
    </div>
    <img class="qr" src="${qrApiUrl}" alt="QR" />
    <div class="hint">Zeskanuj telefonem aby<br>potwierdzić rezerwację miejsca</div>
    <div class="brand">reserti.com</div>
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div>
            <h3 className="font-semibold text-zinc-800 text-base">📋 Kod QR do naklejki</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {resource.name} · {resource.code}
              {resource.location?.name && ` · ${resource.location.name}`}
              {resource.floor && ` · Piętro: ${resource.floor}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-300 hover:text-zinc-500 transition-colors ml-4 mt-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {!qrUrl ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-700 font-medium mb-1">Brak tokenu QR</p>
              <p className="text-xs text-amber-600">
                Ten zasób nie ma jeszcze przypisanego tokenu QR.
                Uruchom migrację bazy danych aby wygenerować tokeny dla istniejących zasobów.
              </p>
            </div>
          ) : (
            <>
              {/* QR preview */}
              <div className="bg-zinc-50 rounded-xl p-4 mb-4 flex flex-col items-center gap-3 border border-zinc-100">
                {qrError ? (
                  <div className="w-44 h-44 rounded-lg bg-zinc-100 flex flex-col items-center justify-center gap-2">
                    <p className="text-xs text-zinc-400 text-center px-3">Nie można załadować kodu QR.<br/>Sprawdź połączenie z internetem.</p>
                  </div>
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                    alt="Kod QR"
                    className="w-44 h-44 rounded-lg"
                    onError={() => setQrError(true)}
                  />
                )}
                <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                  Wydrukuj i naklejaj przy miejscu parkingowym.<br />
                  Użytkownicy skanują telefonem aby potwierdzić przybycie.
                </p>
              </div>

              {/* URL copy */}
              <div className="flex gap-2 mb-4">
                <input
                  readOnly
                  value={qrUrl}
                  className="flex-1 text-xs border border-zinc-200 rounded-lg px-3 py-2
                             text-zinc-400 bg-zinc-50 truncate select-all min-w-0"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copy}
                  className="shrink-0 px-3 py-2 rounded-lg border border-zinc-200
                             hover:bg-zinc-50 transition-all text-sm"
                  title="Kopiuj link"
                >
                  {copied ? '✅' : '📋'}
                </button>
              </div>

              {/* Akcje */}
              <div className="flex gap-2">
                <button
                  onClick={print}
                  className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-medium
                             hover:bg-brand/90 transition-all inline-flex items-center justify-center gap-2"
                >
                  <span>🖨️</span>
                  <span>Drukuj naklejkę</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-600
                             text-sm hover:bg-zinc-50 transition-all"
                >
                  Zamknij
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
