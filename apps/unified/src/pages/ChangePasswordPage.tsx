import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';

interface PasswordPolicy {
  minLength:        number;
  requireUppercase: boolean;
  requireNumbers:   boolean;
  requireSpecial:   boolean;
}

function parseBackendError(msg: string, t: (k: string, o?: any) => string): string {
  if (msg?.startsWith('PASSWORD_TOO_SHORT:')) {
    const min = parseInt(msg.split(':')[1], 10);
    if (isNaN(min)) return t('changePassword.errors.generic');
    return t('changePassword.errors.min_length', { min });
  }
  if (msg === 'PASSWORD_REQUIRE_UPPERCASE') return t('changePassword.errors.require_uppercase');
  if (msg === 'PASSWORD_REQUIRE_NUMBERS')   return t('changePassword.errors.require_numbers');
  if (msg === 'PASSWORD_REQUIRE_SPECIAL')   return t('changePassword.errors.require_special');
  return msg || t('changePassword.errors.generic');
}

export function ChangePasswordPage() {
  const navigate    = useNavigate();
  const { t }       = useTranslation();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState(false);

  const user        = appApi.auth.user();
  const isSso       = (user as any)?.azureObjectId;
  const mustChange  = !!(user as any)?.mustChangePassword;
  const policy      = (user as any)?.passwordPolicy as PasswordPolicy | undefined;
  const minLen = policy?.minLength ?? 8;

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErr(''); };

  const validate = (): string | null => {
    if (!form.currentPassword)                                               return t('changePassword.errors.required_current');
    if (form.newPassword.length < minLen)                                    return t('changePassword.errors.min_length', { min: minLen });
    if (policy?.requireUppercase && !/[A-Z]/.test(form.newPassword))        return t('changePassword.errors.require_uppercase');
    if (policy?.requireNumbers   && !/[0-9]/.test(form.newPassword))        return t('changePassword.errors.require_numbers');
    if (policy?.requireSpecial   && !/[^A-Za-z0-9]/.test(form.newPassword)) return t('changePassword.errors.require_special');
    if (form.newPassword === form.currentPassword)                           return t('changePassword.errors.different');
    if (form.newPassword !== form.confirmPassword)                           return t('changePassword.errors.mismatch');
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) { setErr(error); return; }
    setBusy(true); setErr('');
    try {
      await appApi.auth.changePassword(form.currentPassword, form.newPassword);
      setSuccess(true);
      setTimeout(() => { appApi.auth.logout(); navigate('/login'); }, 2500);
    } catch (e: any) {
      setErr(parseBackendError(e.message, t));
    }
    setBusy(false);
  };

  const strength = (pwd: string) => {
    if (!pwd) return { label: '', color: 'bg-zinc-200', width: 'w-0', score: 0 };
    let score = 0;
    if (pwd.length >= minLen)         score++;
    if (pwd.length >= Math.max(12, minLen + 2)) score++;
    if (/[A-Z]/.test(pwd))            score++;
    if (/[0-9]/.test(pwd))            score++;
    if (/[^A-Za-z0-9]/.test(pwd))    score++;
    if (score <= 1) return { label: t('changePassword.strength.weak'),   color: 'bg-red-500',    width: 'w-1/4',  score };
    if (score <= 2) return { label: t('changePassword.strength.medium'), color: 'bg-amber-400',  width: 'w-2/4',  score };
    if (score <= 3) return { label: t('changePassword.strength.good'),   color: 'bg-blue-400',   width: 'w-3/4',  score };
    return               { label: t('changePassword.strength.strong'),  color: 'bg-emerald-500', width: 'w-full', score };
  };

  const str = strength(form.newPassword);

  // Lista wymagań wg polityki org — pokazuje tick/cross w czasie rzeczywistym
  const requirements: { label: string; met: boolean }[] = [
    { label: t('changePassword.errors.min_length', { min: minLen }).replace(/\.?$/, ''), met: form.newPassword.length >= minLen },
    ...(policy?.requireUppercase ? [{ label: t('changePassword.errors.require_uppercase').replace(/\.?$/, ''), met: /[A-Z]/.test(form.newPassword) }] : []),
    ...(policy?.requireNumbers   ? [{ label: t('changePassword.errors.require_numbers').replace(/\.?$/, ''),   met: /[0-9]/.test(form.newPassword) }] : []),
    ...(policy?.requireSpecial   ? [{ label: t('changePassword.errors.require_special').replace(/\.?$/, ''),   met: /[^A-Za-z0-9]/.test(form.newPassword) }] : []),
  ];

  if (isSso) return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-zinc-800 mb-6">{t('changePassword.title')}</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-sm text-blue-700">
        <p className="font-semibold mb-2">{t('changePassword.sso_managed_title')}</p>
        <p className="text-blue-600">
          {t('changePassword.sso_managed_text')}{' '}
          <a href="https://myaccount.microsoft.com" target="_blank" rel="noreferrer"
            className="underline hover:no-underline font-medium">
            myaccount.microsoft.com
          </a>.
        </p>
      </div>
    </div>
  );

  if (success) return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-zinc-800 mb-6">{t('changePassword.title')}</h1>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
        <p className="text-3xl mb-3">✓</p>
        <p className="font-semibold text-emerald-700 mb-1">{t('changePassword.changed')}</p>
        <p className="text-sm text-emerald-600">{t('changePassword.logging_out')}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-zinc-800 mb-2">{t('changePassword.title')}</h1>
      <p className="text-sm text-zinc-400 mb-6">{t('changePassword.intro')}</p>
      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.current_label')}</label>
            <input type="password" value={form.currentPassword} onChange={e => set('currentPassword', e.target.value)}
              required autoFocus className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.new_label')}</label>
            <input type="password" value={form.newPassword} onChange={e => set('newPassword', e.target.value)}
              required className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all" />

            {form.newPassword && (
              <div className="mt-2">
                <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${str.color} ${str.width}`} />
                </div>
                <p className="text-xs text-zinc-400 mt-1">{str.label}</p>
              </div>
            )}

            {/* Lista wymagań wg polityki org */}
            {requirements.length > 0 && form.newPassword && (
              <ul className="mt-2 space-y-1">
                {requirements.map((req, i) => (
                  <li key={i} className={`flex items-center gap-1.5 text-xs transition-colors ${req.met ? 'text-emerald-600' : 'text-zinc-400'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${req.met ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                      {req.met ? '✓' : '·'}
                    </span>
                    {req.label}
                  </li>
                ))}
              </ul>
            )}
            {requirements.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1.5">{t('changePassword.min_chars')}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.confirm_label')}</label>
            <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
              required className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                form.confirmPassword && form.confirmPassword !== form.newPassword
                  ? 'border-red-300 focus:ring-red-200' : 'border-zinc-200 focus:ring-brand/30'}`} />
            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
              <p className="text-xs text-red-500 mt-1">{t('changePassword.errors.not_identical')}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="button" onClick={() => { if (mustChange) { appApi.auth.logout(); window.location.href = '/login'; } else { navigate(-1); } }}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
              {mustChange ? t('layout.logout') : t('changePassword.cancel')}
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy
                ? <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('changePassword.saving')}
                  </span>
                : t('changePassword.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
