import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props { onLogin: (u: any) => void; }

export function ImpersonatePage({ onLogin }: Props) {
  const [params]      = useSearchParams();
  const navigate      = useNavigate();
  const { t }         = useTranslation();
  const [err, setErr] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setErr(t('impersonate.errors.missing_token')); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.impersonated) { setErr(t('impersonate.errors.not_impersonation')); return; }
      localStorage.setItem('app_access',      token);
      localStorage.setItem('app_impersonated','true');
      const u = {
        id:             payload.sub,
        email:          payload.email ?? 'impersonated@reserti.pl',
        role:           payload.role,
        organizationId: payload.orgId,
        impersonated:   true,
        accessToken:    token,
      };
      localStorage.setItem('app_user', JSON.stringify(u));
      onLogin(u);
      navigate('/dashboard', { replace: true });
    } catch {
      setErr(t('impersonate.errors.invalid_token'));
    }
  }, []);

  if (err) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="text-red-400 text-sm mb-4">{err}</p>
        <button onClick={() => navigate('/login')} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {t('impersonate.back_to_login')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-[#B53578] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">{t('impersonate.authenticating')}</p>
      </div>
    </div>
  );
}
