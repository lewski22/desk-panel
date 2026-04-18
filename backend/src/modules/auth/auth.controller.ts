import {
  Controller, Post, Patch, Get, Body, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard }        from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService }      from './auth.service';
import { AzureAuthService } from './azure-auth.service';
import { RefreshTokenDto }  from './dto/refresh-token.dto';
import { AzureLoginDto }    from './dto/azure-login.dto';
import { ChangePasswordDto }from './dto/change-password.dto';
import { JwtAuthGuard }     from './guards/jwt-auth.guard';
import { GoogleAuthService } from './google-auth.service';
import { Response }          from 'express';
import { Res }               from '@nestjs/common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth:  AuthService,
    private azure: AzureAuthService,
    private google: GoogleAuthService,
  ) {}

  // ── Email / password ─────────────────────────────────────────
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 prób/min per IP
  @ApiOperation({ summary: 'Login — returns access + refresh tokens' })
  login(@Request() req) {
    return this.auth.login(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Rotate refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle()
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // ── Zmiana hasła ──────────────────────────────────────────────
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 prób/min
  @ApiOperation({ summary: 'Zmień hasło — wymaga podania aktualnego hasła' })
  changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  // ── Microsoft / Entra ID SSO ──────────────────────────────────

  @Post('azure')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Login przez Microsoft — wymiana idToken na JWT Reserti' })
  loginAzure(@Body() dto: AzureLoginDto) {
    return this.azure.loginWithAzureToken(dto.idToken);
  }

  @Get('azure/check')
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // publiczny — wyższy limit ale nie bez limitu
  @ApiOperation({ summary: 'Sprawdź czy SSO dostępne dla emaila (publiczny)' })
  checkAzure(
    @Query('email')   email?: string,
    @Query('orgSlug') orgSlug?: string,
  ) {
    return this.azure.checkSsoAvailable(orgSlug, email);
  }
}
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
