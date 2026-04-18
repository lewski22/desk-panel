// ── PATCH: apps/unified/src/api/client.ts ─────────────────────────────────
// Dodaj te metody do istniejącego obiektu appApi.
// Wklej wewnątrz obiektu appApi = { ... } obok istniejących kluczy.

// ── K1: Rekomendacje ────────────────────────────────────────────────────────
desks: {
  // ...istniejące metody desks...

  /**
   * getRecommended — rekomendowane biurko dla aktualnie zalogowanego usera.
   * Zwraca { recommendation: DeskRecommendation | null }
   */
  getRecommended: (params: {
    locationId: string;
    date:       string;
    start?:     string;
    end?:       string;
  }) =>
    axiosInstance
      .get('/desks/recommended', { params })
      .then(r => r.data),
},

// ── K2: Insighty ────────────────────────────────────────────────────────────
insights: {
  /**
   * getForLocation — insighty per lokalizacja.
   * Zwraca { locationId, insights: InsightItem[] }
   */
  getForLocation: (locationId: string) =>
    axiosInstance
      .get('/insights', { params: { locationId } })
      .then(r => r.data),

  /**
   * getForOrg — insighty dla wszystkich lokalizacji orga (OWNER/SUPER_ADMIN).
   * Zwraca { locations: Array<{ locationId, locationName, insights }> }
   */
  getForOrg: (orgId?: string) =>
    axiosInstance
      .get('/insights/org', { params: orgId ? { orgId } : undefined })
      .then(r => r.data),

  /**
   * refresh — ręczne wymuszenie regeneracji insightów (pomija cache TTL).
   * Zwraca { locationId, insights, refreshed: true }
   */
  refresh: (locationId: string) =>
    axiosInstance
      .post('/insights/refresh', null, { params: { locationId } })
      .then(r => r.data),
},
