/**
 * PATCH: backend/src/main.ts
 *
 * Dodaj trasy do listy `exclude` w `app.setGlobalPrefix`.
 * Bez tego:
 *   - POST /graph/webhook zwróci 404 (Microsoft nie może zarejestrować subskrypcji)
 *   - GET /auth/google/callback zwróci 404 (Google nie może przekierować po OAuth2)
 *   - GET /auth/graph/callback zwróci 404 (Microsoft nie może przekierować po OAuth2)
 *   - GET /auth/graph/redirect zwróci 404 (redirect nie zadziała)
 *
 * PRZED:
 *   app.setGlobalPrefix('api/v1', {
 *     exclude: [
 *       { path: 'install/{*path}', method: RequestMethod.GET },
 *       { path: 'metrics',      method: RequestMethod.GET },
 *       { path: 'health',       method: RequestMethod.GET },
 *     ],
 *   });
 *
 * PO:
 */

app.setGlobalPrefix('api/v1', {
  exclude: [
    // Istniejące
    { path: 'install/{*path}',   method: RequestMethod.GET },
    { path: 'metrics',           method: RequestMethod.GET },
    { path: 'health',            method: RequestMethod.GET },

    // Google OAuth2 callback — Google przekierowuje bez /api/v1
    { path: 'auth/google/callback',  method: RequestMethod.GET },

    // Microsoft Graph OAuth2 — redirect + callback poza prefixem
    { path: 'auth/graph/redirect',   method: RequestMethod.GET },
    { path: 'auth/graph/callback',   method: RequestMethod.GET },

    // Microsoft Graph webhook — MUSI być publiczny i poza prefixem
    // Microsoft wysyła POST bez żadnego tokenu auth
    { path: 'graph/webhook',         method: RequestMethod.POST },
  ],
});

/**
 * UWAGA: Endpointy w exclude muszą dokładnie pasować do path zdefiniowanych
 * w @Controller() + @Get()/@Post() dekoratorach.
 *
 * GraphController ma @Controller() (bez path) więc endpointy to:
 *   GET  /auth/graph/redirect   ← exclude ✓
 *   GET  /auth/graph/callback   ← exclude ✓
 *   POST /graph/webhook         ← exclude ✓
 *   GET  /graph/status          ← pozostaje pod /api/v1/graph/status
 *   POST /graph/subscribe       ← pozostaje pod /api/v1/graph/subscribe
 *   DELETE /graph/disconnect    ← pozostaje pod /api/v1/graph/disconnect
 *
 * GoogleAuthService ma endpointy w AuthController (@Controller('auth')):
 *   GET  /auth/google/redirect  ← ZOSTAJE pod /api/v1 (wymaga JWT — poprawne)
 *   GET  /auth/google/callback  ← exclude ✓ (Google przekierowuje na ten URL)
 *   GET  /auth/google/check     ← ZOSTAJE pod /api/v1 (publiczny ale z throttle)
 *
 * WAŻNE: GraphController musi być osobną klasą kontrolera — nie wewnątrz AuthModule.
 * Jeśli GraphController jest w GatewaysModule lub podobnym — nic nie zmieniaj.
 */
