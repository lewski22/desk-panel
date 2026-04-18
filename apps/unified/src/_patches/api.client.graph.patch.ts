// ── PATCH: apps/unified/src/api/client.ts ─────────────────────────────────────
// Dodaj dwa klucze do głównego obiektu appApi.

// ── Google Auth ──────────────────────────────────────────────────────────────
google: {
  /**
   * check — sprawdź czy Google SSO dostępne dla emaila.
   * Zwraca { available: boolean; domain?: string }
   */
  check: (email?: string, orgSlug?: string) =>
    axiosInstance
      .get('/auth/google/check', { params: { email, orgSlug } })
      .then(r => r.data),
},

// ── Microsoft Graph Sync ──────────────────────────────────────────────────────
graph: {
  /**
   * status — status połączenia Outlook Calendar dla aktualnego usera.
   * Zwraca { connected: boolean; tokenValid?: boolean }
   */
  status: () =>
    axiosInstance.get('/graph/status').then(r => r.data),

  /**
   * disconnect — odłącz Outlook Calendar (usuń tokeny i subskrypcje).
   */
  disconnect: () =>
    axiosInstance.delete('/graph/disconnect').then(r => r.data),

  /**
   * subscribe — ręcznie utwórz webhook subskrypcję.
   */
  subscribe: () =>
    axiosInstance.post('/graph/subscribe').then(r => r.data),
},
