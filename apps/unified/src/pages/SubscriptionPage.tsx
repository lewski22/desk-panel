/**
 * SubscriptionPage — Sprint B2
 * /subscription — widok dla SUPER_ADMIN
 * PlanBadge + UsageBar + FeatureList + ExpiryBanner
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format }          from 'date-fns';
import { pl, enUS }        from 'date-fns/locale';
import { appApi }          from '../api/client';
import { Spinner, Card }   from '../components/ui';
import { PlanBadge }       from '../components/subscription/PlanBadge';
import { UsageBar }        from '../components/subscription/UsageBar';

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  active:          { cls: 'bg-emerald-100 text-emerald-700', label: 'subscription.status.active' },
  expiring_soon:   { cls: 'bg-amber-100 text-amber-700',    label: 'subscription.status.expiring_soon' },
  expired:         { cls: 'bg-red-100 text-red-600',        label: 'subscription.status.expired' },
  trial:           { cls: 'bg-sky-100 text-sky-700',        label: 'subscription.status.trial' },
  trial_expiring:  { cls: 'bg-amber-100 text-amber-700',    label: 'subscription.status.trial_expiring' },
};

export function SubscriptionPage() {
  const { t, i18n }    = useTranslation();
  const dfns            = i18n.language === 'en' ? enUS : pl;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    appApi.subscription.getStatus()
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (err)     return <div className="p-4 text-red-600">{err}</div>;
  if (!data)   return null;

  const statusCfg = STATUS_CFG[data.status] ?? STATUS_CFG.active;
  const expiryDate = data.trialEndsAt ?? data.planExpiresAt;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('subscription.title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('subscription.subtitle')}</p>
        </div>
        <PlanBadge plan={data.plan} size="md" />
      </div>

      {/* Plan status card */}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-zinc-800">{t('subscription.plan')}: {data.planLabel}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.cls}`}>
                {t(statusCfg.label)}
              </span>
            </div>
            {expiryDate && (
              <p className="text-sm text-zinc-500">
                {data.trialEndsAt ? t('subscription.trial_ends') : t('subscription.valid_until')}:
                {' '}
                <span className="font-medium text-zinc-700">
                  {format(new Date(expiryDate), 'dd MMMM yyyy', { locale: dfns })}
                </span>
                {data.daysUntilExpiry !== null && (
                  <span className={`ml-2 text-xs font-semibold ${
                    data.daysUntilExpiry <= 7  ? 'text-red-600' :
                    data.daysUntilExpiry <= 14 ? 'text-amber-600' : 'text-zinc-400'
                  }`}>
                    ({t('subscription.days_left', { count: data.daysUntilExpiry })})
                  </span>
                )}
              </p>
            )}
            {!expiryDate && (
              <p className="text-sm text-zinc-400">{t('subscription.no_expiry')}</p>
            )}
            {data.billingEmail && (
              <p className="text-xs text-zinc-400 mt-1">📩 {data.billingEmail}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Usage bars */}
      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">{t('subscription.usage.title')}</h2>
        <div className="space-y-4">
          <UsageBar label={t('subscription.usage.desks')}     {...data.usage.desks} />
          <UsageBar label={t('subscription.usage.users')}     {...data.usage.users} />
          <UsageBar label={t('subscription.usage.gateways')}  {...data.usage.gateways} />
          <UsageBar label={t('subscription.usage.locations')} {...data.usage.locations} />
        </div>
      </Card>

      {/* Features */}
      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">{t('subscription.features.title')}</h2>
        <div className="space-y-2.5">
          {([
            ['ota',  'subscription.features.ota'],
            ['sso',  'subscription.features.sso'],
            ['smtp', 'subscription.features.smtp'],
            ['api',  'subscription.features.api'],
          ] as const).map(([key, labelKey]) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                data.features[key]
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-400'
              }`}>
                {data.features[key] ? '✓' : '✗'}
              </span>
              <span className={`text-sm ${data.features[key] ? 'text-zinc-700' : 'text-zinc-400'}`}>
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* CTA */}
      <p className="text-sm text-zinc-400 text-center mt-2">
        {t('subscription.contact_cta')}{' '}
        <a href="mailto:hello@reserti.pl" className="text-[#B53578] hover:underline">→</a>
      </p>
    </div>
  );
}
