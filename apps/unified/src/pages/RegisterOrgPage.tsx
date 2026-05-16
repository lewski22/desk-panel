import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Input, Btn } from '../components/ui';

export function RegisterOrgPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    orgName: '', adminEmail: '', adminFirstName: '',
    adminLastName: '', password: '', confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (form.password !== form.confirm) {
      setErr(t('register_org.passwords_mismatch')); return;
    }
    setLoading(true); setErr('');
    try {
      await appApi.auth.registerOrg({
        orgName:        form.orgName,
        adminEmail:     form.adminEmail,
        adminFirstName: form.adminFirstName,
        adminLastName:  form.adminLastName,
        password:       form.password,
      });
      navigate('/login', { state: { registered: true } });
    } catch (e: any) {
      setErr(e.message ?? t('register_org.error_fallback'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm
                      border border-zinc-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">
            {t('register_org.title')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t('register_org.subtitle')}
          </p>
        </div>

        <div className="space-y-3">
          <Input label={t('register_org.org_name')}
            value={form.orgName} onChange={set('orgName')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('register_org.first_name')}
              value={form.adminFirstName} onChange={set('adminFirstName')} />
            <Input label={t('register_org.last_name')}
              value={form.adminLastName} onChange={set('adminLastName')} />
          </div>
          <Input label={t('register_org.email')} type="email"
            value={form.adminEmail} onChange={set('adminEmail')} />
          <Input label={t('register_org.password')} type="password"
            value={form.password} onChange={set('password')} />
          <Input label={t('register_org.password_confirm')} type="password"
            value={form.confirm} onChange={set('confirm')} />
        </div>

        {err && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border
                        border-red-200 rounded-lg px-3 py-2">{err}</p>
        )}

        <Btn className="w-full mt-5" onClick={submit} disabled={loading}>
          {loading ? t('register_org.submitting') : t('register_org.submit')}
        </Btn>

        <p className="text-center text-xs text-zinc-400 mt-4">
          {t('register_org.have_account')}{' '}
          <Link to="/login" className="text-brand hover:underline">
            {t('register_org.login_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
