/**
 * RegisterPage — #15 Registration flow
 * Route: /register/:token (public)
 * Invitation token → fill profile → account created → redirect /login
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate }     from 'react-router-dom';
import { useTranslation }             from 'react-i18next';
import { appApi }                     from '../api/client';

const ROLE_LABEL: Record<string, string> = {
  END_USER:     'Użytkownik',
  STAFF:        'Staff',
  OFFICE_ADMIN: 'Administrator biura',
  SUPER_ADMIN:  'Super Admin',
};

type Step = 'loading' | 'error' | 'form' | 'success';

export function RegisterPage() {
  const { token }    = useParams<{ token: string }>();
  const navigate     = useNavigate();
  const { t }        = useTranslation();

  const [step,        setStep]       = useState<Step>('loading');
  const [inviteInfo,  setInviteInfo] = useState<{ email: string; orgName: string; role: string } | null>(null);
  const [errorMsg,    setErrorMsg]   = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '', confirm: '' });
  const [busy,        setBusy]       = useState(false);
  const [formErr,     setFormErr]    = useState('');

  useEffect(() => {
    if (!token) { setStep('error'); setErrorMsg(t('register.error_no_token')); return; }
    appApi.auth.getInviteInfo(token)
      .then(info => {
        if (info.used)    { setStep('error'); setErrorMsg(t('register.error_used'));    return; }
        if (info.expired) { setStep('error'); setErrorMsg(t('register.error_expired')); return; }
        setInviteInfo(info);
        setStep('form');
      })
      .catch(() => { setStep('error'); setErrorMsg(t('register.error_invalid')); });
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (form.password !== form.confirm) { setFormErr(t('register.error_password_mismatch')); return; }
    if (form.password.length < 8) { setFormErr(t('register.error_password_short')); return; }
    setBusy(true);
    try {
      await appApi.auth.register({
        token:     token!,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        password:  form.password,
      });
      setStep('success');
    } catch (err: any) {
      setFormErr(err.message ?? t('register.error_generic'));
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-brand font-black text-3xl tracking-tight">RESERTI</span>
          <p className="text-zinc-400 text-sm mt-1">{t('register.page_subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="font-semibold text-zinc-800 mb-2">{t('register.error_title')}</p>
              <p className="text-sm text-zinc-500 mb-6">{errorMsg}</p>
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-brand font-medium hover:underline"
              >
                {t('register.back_to_login')}
              </button>
            </div>
          )}

          {/* Form */}
          {step === 'form' && inviteInfo && (
            <>
              <div className="mb-5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <p className="text-xs text-zinc-400 mb-1">{t('register.invited_to')}</p>
                <p className="font-semibold text-zinc-800 text-sm">{inviteInfo.orgName}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{inviteInfo.email}</p>
                <span className="inline-block mt-1.5 text-[10px] font-medium bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                  {ROLE_LABEL[inviteInfo.role] ?? inviteInfo.role}
                </span>
              </div>

              <h2 className="text-base font-semibold text-zinc-800 mb-4">{t('register.form_title')}</h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{t('register.first_name')}</label>
                    <input
                      required
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
                      value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{t('register.last_name')}</label>
                    <input
                      required
                      className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
                      value={form.lastName}
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">{t('register.password')}</label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">{t('register.confirm_password')}</label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  />
                </div>

                {formErr && <p className="text-xs text-red-500">{formErr}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 w-full bg-brand hover:bg-brand-hover text-white font-semibold py-2.5 rounded-xl
                    text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? t('register.creating') : t('register.create_account')}
                </button>
              </form>
            </>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-semibold text-zinc-800 mb-2">{t('register.success_title')}</p>
              <p className="text-sm text-zinc-500 mb-6">{t('register.success_body')}</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-2.5 rounded-xl
                  text-sm transition-colors"
              >
                {t('register.go_to_login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
