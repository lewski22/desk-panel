// ── PATCH: apps/unified/src/api/client.ts ─────────────────────────────────────
// Dodaj do istniejącego obiektu appApi — obok istniejących kluczy.

graph: {
  /** Status połączenia Outlook Calendar dla zalogowanego usera */
  status: () =>
    axiosInstance.get('/graph/status').then(r => r.data) as Promise<{
      connected: boolean;
      tokenValid?: boolean;
    }>,

  /** Odłącz Outlook Calendar — usuwa tokeny i subskrypcje webhook */
  disconnect: () =>
    axiosInstance.delete('/graph/disconnect').then(r => r.data),

  /** Ręcznie utwórz webhook subskrypcję Graph */
  subscribe: () =>
    axiosInstance.post('/graph/subscribe').then(r => r.data),
},

google: {
  /**
   * Sprawdź czy Google SSO jest dostępne dla emaila (publiczny endpoint).
   * Wywołuj przy zmianie pola email na LoginPage.
   * Zwraca { available: boolean; domain?: string }
   */
  check: (email?: string, orgSlug?: string) =>
    axiosInstance.get('/auth/google/check', { params: { email, orgSlug } })
      .then(r => r.data) as Promise<{ available: boolean; domain?: string }>,
},
