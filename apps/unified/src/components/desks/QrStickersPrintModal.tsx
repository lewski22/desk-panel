import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { Modal, Btn } from '../ui';

interface Desk {
  id: string; name: string; code: string;
  qrToken: string; floor?: string | null; zone?: string | null;
}
interface Props {
  desks: Desk[]; locationName: string; onClose: () => void;
}

const APP_URL = (import.meta as any).env?.VITE_APP_URL ?? window.location.origin;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function QrStickersPrintModal({ desks, locationName, onClose }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(new Set(desks.map(d => d.id)));
  const [qrMap,    setQrMap]    = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const d of desks) {
        if (d.qrToken) {
          map[d.id] = await QRCode.toDataURL(
            `${APP_URL}/checkin/${d.qrToken}`,
            { width: 200, margin: 1 }
          ).catch(() => '');
        }
      }
      setQrMap(map);
      setLoading(false);
    })();
  }, [desks]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const handlePrint = () => {
    const list = desks.filter(d => selected.has(d.id));
    if (!list.length) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const stickers = list.map(d => {
      const meta = [
        d.floor && `Piętro ${esc(d.floor)}`, d.zone && esc(d.zone)
      ].filter(Boolean).join(' · ');
      return `<div class="sticker">
        ${qrMap[d.id]
          ? `<img src="${qrMap[d.id]}" />`
          : '<div class="no-qr">Brak QR</div>'}
        <div class="name">${esc(d.name)}</div>
        <div class="code">${esc(d.code)}${meta ? ` · ${meta}` : ''}</div>
        <div class="loc">${esc(locationName)}</div>
        <div class="brand">reserti.com</div>
      </div>`;
    }).join('');

    w.document.write(`<!DOCTYPE html><html><head>
      <title>QR — ${esc(locationName)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,sans-serif;padding:12mm}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
        .sticker{border:1.5px dashed #d4d4d8;border-radius:8mm;padding:6mm;
          text-align:center;display:flex;flex-direction:column;
          align-items:center;gap:3mm;break-inside:avoid;page-break-inside:avoid}
        .sticker img{width:44mm;height:44mm}
        .no-qr{width:44mm;height:44mm;display:flex;align-items:center;
          justify-content:center;background:#f4f4f5;border-radius:4mm;
          font-size:9px;color:#999}
        .name{font-size:13px;font-weight:700;color:#18181b}
        .code,.loc{font-size:9px;color:#71717a}
        .brand{font-size:9px;color:#B53578;font-weight:700;margin-top:1mm}
        @media print{@page{margin:10mm;size:A4}body{padding:0}}
      </style>
    </head><body>
      <div class="grid">${stickers}</div>
      <script>window.onload=()=>{window.focus();window.print();}<\/script>
    </body></html>`);
    w.document.close();
  };

  return (
    <Modal title={t('qr_stickers.title', { locationName })} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {t('qr_stickers.selected_count', { selected: selected.size, total: desks.length })}
          </span>
          <button
            onClick={() => setSelected(
              selected.size === desks.length
                ? new Set()
                : new Set(desks.map(d => d.id))
            )}
            className="text-xs text-brand hover:underline"
          >
            {selected.size === desks.length
              ? t('qr_stickers.deselect_all')
              : t('qr_stickers.select_all')}
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand
                            rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {desks.map(d => (
              <label key={d.id}
                className="flex items-center gap-3 p-2.5 rounded-lg
                           border border-zinc-100 hover:bg-zinc-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="rounded accent-brand" />
                <span className="text-sm font-medium text-zinc-800 flex-1">
                  {d.name}
                </span>
                <span className="text-xs text-zinc-400">{d.code}</span>
                {qrMap[d.id]
                  ? <img src={qrMap[d.id]} className="w-8 h-8 rounded" alt="" />
                  : <span className="w-8 text-center text-xs text-zinc-300">—</span>}
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-zinc-400 text-center">
          {t('qr_stickers.footer')}
        </p>

        <div className="flex gap-3">
          <Btn variant="secondary" className="flex-1" onClick={onClose}>
            {t('qr_stickers.close')}
          </Btn>
          <Btn className="flex-1" onClick={handlePrint}
               disabled={!selected.size || loading}>
            🖨️ {selected.size > 0
              ? t('qr_stickers.print_count', { count: selected.size })
              : t('qr_stickers.print')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
