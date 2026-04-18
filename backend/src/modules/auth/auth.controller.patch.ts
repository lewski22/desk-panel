// ── PATCH: backend/src/modules/auth/auth.controller.ts ───────────────────────
//
// 1. Dodaj import (obok istniejących):
//    import { GoogleAuthService } from './google-auth.service';
//    import { Response }          from 'express';
//    import { Res }               from '@nestjs/common';   // (już może być)
//
// 2. Dodaj do konstruktora (obok this.auth i this.azure):
//    constructor(
//      private auth:   AuthService,
//      private azure:  AzureAuthService,
//      private google: GoogleAuthService,   // ← DODAJ
//    ) {}
//
// 3. Dodaj endpointy poniżej istniejącego @Get('azure/check'):

  // ── Google Workspace SSO ──────────────────────────────────────

  /**
   * GET /auth/google/redirect
   *
   * Przekierowuje użytkownika do Google OAuth2 consent page.
   * orgId pobierany z JWT (zalogowany user) lub z query param (publiczny).
   *
   * Użycie z panelu: user kliknie "Połącz Google Workspace"
   * → frontend wywołuje GET /auth/google/redirect
   * → backend buduje URL i wykonuje 302 redirect do Google
   */
  @Get('google/redirect')
  @HttpCode(HttpStatus.FOUND)
  @SkipThrottle()
  async googleRedirect(
    @Query('orgId')      orgId:      string | undefined,
    @Query('redirectUrl') redirectUrl: string | undefined,
    @Request() req:      any,
    @Res() res:          Response,
  ): Promise<void> {
    // Preferuj orgId z JWT (zalogowany), fallback do query param
    const resolvedOrgId = req.user?.organizationId ?? orgId;
    if (!resolvedOrgId) {
      res.status(400).json({ message: 'orgId jest wymagany' });
      return;
    }

    try {
      const url = await this.google.buildRedirectUrl(resolvedOrgId, redirectUrl);
      res.redirect(302, url);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }

  /**
   * GET /auth/google/callback
   *
   * Odbiera code od Google, wymienia na tokeny, wydaje JWT Reserti.
   * Przekierowuje do frontendu z tokenem jako hash parameter.
   *
   * Google redirect URI: https://api.prohalw2026.ovh/api/v1/auth/google/callback
   * Pamiętaj dodać do Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
   */
  @Get('google/callback')
  @HttpCode(HttpStatus.FOUND)
  @SkipThrottle()
  async googleCallback(
    @Query('code')  code:  string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res:     Response,
  ): Promise<void> {
    // Google może zwrócić błąd jeśli user odmówił zgody
    if (error) {
      res.redirect(`${process.env.FRONTEND_URL ?? 'https://staff.prohalw2026.ovh'}/login?error=google_denied`);
      return;
    }

    try {
      const { accessToken, redirectUrl } = await this.google.handleCallback(code, state);
      // Przekieruj do frontendu z tokenem w hash (nie w query — nie loguje się w serwerze)
      res.redirect(`${redirectUrl}/login#google_token=${accessToken}`);
    } catch (err: any) {
      const msg = encodeURIComponent(err.message ?? 'Błąd logowania Google');
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://staff.prohalw2026.ovh';
      res.redirect(`${frontendUrl}/login?error=google_auth&msg=${msg}`);
    }
  }

  /**
   * GET /auth/google/check
   *
   * Sprawdź czy Google SSO jest dostępne dla danego emaila.
   * Publiczny — wywoływany przez formularz logowania.
   */
  @Get('google/check')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async checkGoogle(
    @Query('email')   email?:   string,
    @Query('orgSlug') orgSlug?: string,
  ) {
    return this.google.checkAvailable(email, orgSlug);
  }

// ── auth.module.ts — dodaj GoogleAuthService ──────────────────────────────────
//
// import { GoogleAuthService } from './google-auth.service';
//
// @Module({
//   ...
//   providers: [
//     AuthService,
//     AzureAuthService,
//     GoogleAuthService,   // ← DODAJ
//     JwtStrategy,
//     LocalStrategy,
//   ],
//   exports: [
//     AuthService,
//     AzureAuthService,
//     GoogleAuthService,   // ← DODAJ jeśli inne moduły potrzebują
//   ],
// })
//
// IntegrationsModule jest @Global() — GoogleProvider i IntegrationsService
// dostępne automatycznie.
