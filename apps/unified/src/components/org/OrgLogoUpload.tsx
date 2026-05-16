import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../../api/client';
import { Btn } from '../ui';

const BACKEND = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1$/, '');
const ALLOWED_MIME = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
const MAX_BYTES    = 512 * 1024;

interface Props {
  orgId:              string;
  logoUrl:            string | null;
  logoBgColor?:       string | null;
  whitelabelEnabled:  boolean;
  onSaved:            () => void;
}

export function OrgLogoUpload({ orgId, logoUrl, logoBgColor, whitelabelEnabled, onSaved }: Props) {
  const { t }   = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [err,        setErr]        = useState('');

  const validate = (file: File): string | null => {
    if (!ALLOWED_MIME.includes(file.type)) return 'Nieobsługiwany format (PNG, SVG, WEBP, JPEG)';
    if (file.size > MAX_BYTES) return 'Plik za duży (max 512 KB)';
    return null;
  };

  const upload = async (file: File) => {
    const e = validate(file);
    if (e) { setErr(e); return; }
    setErr(''); setUploading(true);
    try {
      await appApi.organizations.uploadLogo(orgId, file);
      onSaved();
    } catch (ex: any) { setErr(ex.message ?? 'Błąd przesyłania'); }
    setUploading(false);
  };

  const handleFile = (files: FileList | null) => {
    if (files?.[0]) upload(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files);
  };

  const handleDelete = async () => {
    if (!window.confirm('Usunąć logo?')) return;
    setDeleting(true); setErr('');
    try {
      await appApi.organizations.deleteLogo(orgId);
      onSaved();
    } catch (ex: any) { setErr(ex.message ?? 'Błąd usuwania'); }
    setDeleting(false);
  };

  return (
    <section className="mt-6 border border-zinc-200 rounded-2xl p-5 bg-white">
      <h2 className="text-sm font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
        <i className="ti ti-photo text-[#A898B8]" aria-hidden="true" />
        Logo organizacji
      </h2>
      <p className="text-xs text-zinc-400 mb-4">
        PNG, SVG, WEBP lub JPEG · max 512 KB. Logo wyświetlane gdy white-labeling jest aktywny.
      </p>

      {/* Warning: logo uploaded but whitelabel disabled */}
      {logoUrl && !whitelabelEnabled && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-800">
          <i className="ti ti-alert-triangle text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          {t('org.logo.whitelabel_disabled')}
        </div>
      )}

      {/* Current logo preview */}
      {logoUrl && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-xl border border-zinc-200 flex items-center justify-center overflow-hidden"
               style={{ background: logoBgColor ?? '#fff' }}>
            <img src={`${BACKEND}${logoUrl}`} alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">{logoUrl.split('/').pop()}</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 disabled:opacity-40"
            >
              <i className="ti ti-trash" aria-hidden="true" />
              {deleting ? 'Usuwam…' : 'Usuń logo'}
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-[#B53578] bg-[#FDF4F9]'
            : 'border-zinc-200 hover:border-[#B53578] hover:bg-[#FDF4F9]/40'
        }`}
      >
        <i className="ti ti-cloud-upload text-2xl text-[#A898B8] mb-2 block" aria-hidden="true" />
        <p className="text-xs text-zinc-500">
          {uploading ? 'Przesyłam…' : 'Upuść plik lub kliknij, aby wybrać'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          className="hidden"
          onChange={e => handleFile(e.target.files)}
        />
      </div>

      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      <div className="mt-3">
        <Btn
          variant="secondary"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-upload mr-1" aria-hidden="true" />
          {logoUrl ? 'Zmień logo' : 'Prześlij logo'}
        </Btn>
      </div>
    </section>
  );
}
