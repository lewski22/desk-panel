// ── PATCH: apps/unified/src/pages/LoginPage.tsx ──────────────────────────────
//
// 1. Dodaj sprawdzanie Google SSO przy zmianie emaila (obok checkAzure):

  // W useEffect sprawdzającym SSO:
  useEffect(() => {
    if (!email) return;
    // Sprawdź Azure SSO (istniejące)
    appApi.auth.checkAzure({ email }).then(r => setAzureAvailable(r?.available ?? false));
    // Sprawdź Google SSO (nowe)
    fetch(`${import.meta.env.VITE_API_URL}/auth/google/check?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(r => setGoogleAvailable(r?.available ?? false))
      .catch(() => {});
  }, [email]);

// 2. Dodaj stan dla Google:
//   const [googleAvailable, setGoogleAvailable] = useState(false);

// 3. Handler kliknięcia przycisku Google:
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin;
    window.location.href =
      `${import.meta.env.VITE_API_URL}/auth/google/redirect?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  };

// 4. Obsługa tokenu zwróconego po redirect (hash #google_token=...):
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#google_token=')) {
      const token = hash.slice('#google_token='.length);
      // Zapisz token i zaloguj użytkownika
      localStorage.setItem('access_token', token);
      window.history.replaceState({}, '', window.location.pathname);
      navigate('/dashboard');
    }
    // Obsłuż błędy
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'google_auth') {
      setLoginError(decodeURIComponent(params.get('msg') ?? 'Błąd logowania Google'));
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error') === 'google_denied') {
      setLoginError('Logowanie przez Google zostało anulowane');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

// 5. W JSX — dodaj przycisk Google po przycisku Microsoft (jeśli googleAvailable):
  {googleAvailable && (
    <button
      onClick={handleGoogleLogin}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '9px 16px', borderRadius: 8,
        border: '0.5px solid var(--color-border-secondary)',
        background: 'transparent', cursor: 'pointer', fontSize: 13,
      }}
    >
      {/* Google "G" SVG */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-5 7.2v6h8c4.7-4.3 7.3-10.7 7.3-17.3z"/>
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8-6c-2.1 1.4-4.8 2.2-7.9 2.2-6.1 0-11.2-4.1-13-9.6H2.7v6.2C6.7 42.6 14.8 48 24 48z"/>
        <path fill="#FBBC05" d="M11 28.8A14.1 14.1 0 0 1 11 19.2v-6.2H2.7A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.8L11 28.8z"/>
        <path fill="#EA4335" d="M24 9.6c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.5 30.5 0 24 0 14.8 0 6.7 5.4 2.7 13.2l8.3 6.2c1.8-5.5 6.9-9.8 13-9.8z"/>
      </svg>
      Zaloguj przez Google
    </button>
  )}
