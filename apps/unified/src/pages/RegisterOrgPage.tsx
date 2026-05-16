import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { appApi } from '../api/client';
import { Input, Btn } from '../components/ui';

export function RegisterOrgPage() {
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
      setErr('Hasła nie są identyczne'); return;
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
      setErr(e.message ?? 'Błąd rejestracji');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm
                      border border-zinc-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">
            Załóż konto Reserti
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Plan Free · 5 biurek · bez karty kredytowej
          </p>
        </div>

        <div className="space-y-3">
          <Input label="Nazwa firmy"
            value={form.orgName} onChange={set('orgName')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Imię"
              value={form.adminFirstName} onChange={set('adminFirstName')} />
            <Input label="Nazwisko"
              value={form.adminLastName} onChange={set('adminLastName')} />
          </div>
          <Input label="Email" type="email"
            value={form.adminEmail} onChange={set('adminEmail')} />
          <Input label="Hasło" type="password"
            value={form.password} onChange={set('password')} />
          <Input label="Powtórz hasło" type="password"
            value={form.confirm} onChange={set('confirm')} />
        </div>

        {err && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border
                        border-red-200 rounded-lg px-3 py-2">{err}</p>
        )}

        <Btn className="w-full mt-5" onClick={submit} disabled={loading}>
          {loading ? 'Zakładanie konta…' : 'Załóż konto Free'}
        </Btn>

        <p className="text-center text-xs text-zinc-400 mt-4">
          Masz już konto?{' '}
          <Link to="/login" className="text-brand hover:underline">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  );
}
