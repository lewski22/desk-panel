import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerApi } from '../api/client';
import { Btn, Card, Input } from '../components/ui';

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewClientPage() {
  const navigate = useNavigate();
  const [step, setStep]   = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err,    setErr]    = useState('');

  const [org, setOrg] = useState({
    name: '', slug: '', plan: 'starter',
    contactEmail: '', notes: '', trialDays: '',
  });
  const [admin, setAdmin] = useState({ adminName: '', adminEmail: '' });

  const setOrgField = (k: string, v: string) =>
    setOrg(o => ({ ...o, ...(k === 'name' ? { name: v, slug: slugify(v) } : { [k]: v }) }));

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      const res = await ownerApi.organizations.create({
        ...org,
        trialDays: org.trialDays ? Number(org.trialDays) : undefined,
        ...admin,
      });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  if (result) return (
    <div className="max-w-xl mx-auto">
      <Card>
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-emerald-600 text-2xl">✓</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-800">Firma utworzona!</h2>
          <p className="text-zinc-400 text-sm mt-1">{result.org.name}</p>
        </div>

        <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1.5 mb-5">
          <p><span className="text-zinc-500">Email:    </span>{result.user.email}</p>
          <p><span className="text-zinc-500">Hasło:    </span><span className="text-amber-400">{result.temporaryPassword}</span></p>
          <p><span className="text-zinc-500">Rola:     </span>{result.user.role}</p>
          <p><span className="text-zinc-500">Org ID:   </span>{result.org.id}</p>
        </div>

        <p className="text-xs text-red-500 mb-5">
          ⚠ Zapisz hasło — nie będzie wyświetlone ponownie. Przekaż je administratorowi firmy.
        </p>

        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => navigate('/clients')}>Lista klientów</Btn>
          <Btn onClick={() => navigate(`/clients/${result.org.id}`)}>Szczegóły firmy</Btn>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/clients')} className="text-zinc-400 hover:text-zinc-700 text-sm">← Klienci</button>
        <h1 className="text-xl font-semibold text-zinc-800">Nowy klient</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map(s => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${step === s ? 'text-[#B53578]' : s < step ? 'text-emerald-600' : 'text-zinc-400'}`}>
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center border-2 ${step === s ? 'border-[#B53578] bg-[#B53578]/10' : s < step ? 'border-emerald-500 bg-emerald-100' : 'border-zinc-300'}`}>
                {s < step ? '✓' : s}
              </span>
              {s === 1 ? 'Dane firmy' : 'Administrator'}
            </div>
            {s < 2 && <div className="flex-1 h-px bg-zinc-200" />}
          </React.Fragment>
        ))}
      </div>

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      <Card>
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input label="Nazwa firmy *" value={org.name}
              onChange={e => setOrgField('name', e.target.value)}
              placeholder="Acme sp. z o.o." />
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Slug *</label>
              <div className="flex items-center border border-zinc-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#B53578]/30">
                <span className="px-3 py-2.5 bg-zinc-50 text-zinc-400 text-xs border-r border-zinc-200">ID:</span>
                <input value={org.slug} onChange={e => setOrgField('slug', e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-sm font-mono focus:outline-none" placeholder="acme-sp-z-oo" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Plan</label>
              <select value={org.plan} onChange={e => setOrgField('plan', e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <Input label="Email kontaktowy" type="email" value={org.contactEmail}
              onChange={e => setOrgField('contactEmail', e.target.value)}
              placeholder="it@firma.pl" />
            <Input label="Dni trial (opcjonalne)" type="number" value={org.trialDays}
              onChange={e => setOrgField('trialDays', e.target.value)}
              placeholder="30" />
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Notatki</label>
              <textarea value={org.notes} onChange={e => setOrgField('notes', e.target.value)}
                rows={2} placeholder="Notatki wewnętrzne…"
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 resize-none" />
            </div>
            <div className="flex justify-end pt-2">
              <Btn onClick={() => { setErr(''); if (!org.name || !org.slug) { setErr('Wypełnij nazwę i slug.'); return; } setStep(2); }}>
                Dalej →
              </Btn>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-zinc-50 text-sm text-zinc-600">
              Pierwszy Super Admin tej firmy. Będzie mógł zalogować się hasłem tymczasowym
              i zarządzać biurkami, użytkownikami i provisioningiem.
            </div>
            <Input label="Imię i nazwisko *" value={admin.adminName}
              onChange={e => setAdmin(a => ({ ...a, adminName: e.target.value }))}
              placeholder="Jan Kowalski" />
            <Input label="Email *" type="email" value={admin.adminEmail}
              onChange={e => setAdmin(a => ({ ...a, adminEmail: e.target.value }))}
              placeholder="jan.kowalski@firma.pl" />
            <div className="flex justify-between pt-2">
              <Btn variant="secondary" onClick={() => setStep(1)}>← Wróć</Btn>
              <Btn loading={saving} onClick={submit}
                disabled={!admin.adminName || !admin.adminEmail}>
                Utwórz klienta
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
