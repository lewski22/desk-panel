// ── PATCH: apps/unified/src/api/client.ts ─────────────────────────────────────
// Dodaj klucz "integrations" do głównego obiektu appApi
// (obok istniejących: desks, reservations, notifications, insights, itp.)

integrations: {
  /** Lista wszystkich integracji organizacji */
  list: () =>
    axiosInstance.get('/integrations').then(r => r.data),

  /** Jedna integracja po providerze */
  get: (provider: string) =>
    axiosInstance.get(`/integrations/${provider}`).then(r => r.data),

  /**
   * Zapisz/zaktualizuj konfigurację (upsert).
   * config — plain object (backend zaszyfruje)
   */
  upsert: (
    provider: string,
    body: {
      config:       Record<string, unknown>;
      displayName?: string;
      tenantHint?:  string;
      isEnabled?:   boolean;
    },
  ) =>
    axiosInstance.put(`/integrations/${provider}`, body).then(r => r.data),

  /** Włącz lub wyłącz integrację */
  toggle: (provider: string, isEnabled: boolean) =>
    axiosInstance
      .patch(`/integrations/${provider}/toggle`, { isEnabled })
      .then(r => r.data),

  /** Usuń całą konfigurację integracji */
  remove: (provider: string) =>
    axiosInstance.delete(`/integrations/${provider}`).then(r => r.data),

  /** Test połączenia — zwraca { ok, message } */
  test: (provider: string) =>
    axiosInstance.post(`/integrations/${provider}/test`).then(r => r.data),
},
