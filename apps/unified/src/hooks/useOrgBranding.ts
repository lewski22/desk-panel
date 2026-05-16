import { useEffect, useState } from 'react';
import { appApi } from '../api/client';

export interface OrgBranding {
  name:              string;
  logoUrl:           string | null;
  logoBgColor:       string | null;
  whitelabelEnabled: boolean;
}

export function useOrgBranding(orgId: string | undefined): OrgBranding | null {
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  useEffect(() => {
    if (!orgId) return;
    appApi.organizations.findOne(orgId)
      .then((org: any) => {
        setBranding({
          name:              org.name,
          logoUrl:           org.logoUrl           ?? null,
          logoBgColor:       org.logoBgColor       ?? null,
          whitelabelEnabled: org.whitelabelEnabled ?? false,
        });
      })
      .catch(() => {});
  }, [orgId]);

  return branding;
}
