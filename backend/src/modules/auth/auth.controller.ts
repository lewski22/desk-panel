import {
  Controller, Post, Patch, Get, Body, Query, Param,
  UseGuards, Request, HttpCode, HttpStatus, Res, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard }            from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService }          from './auth.service';
import { AzureAuthService }     from './azure-auth.service';
import { GoogleAuthService }    from './google-auth.service';
import { AzureLoginDto }        from './dto/azure-login.dto';
import { ChangePasswordDto }    from './dto/change-password.dto';
import { InviteUserDto }        from './dto/invite-user.dto';
import { RegisterDto }          from './dto/register.dto';
import { JwtAuthGuard }         from './guards/jwt-auth.guard';
import { RolesGuard }           from './guards/roles.guard';
import { Roles }                from './decorators/roles.decorator';
import { UserRole }             from '@prisma/client';

const IS_DEV = process.env.NODE_ENV !== 'production';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshDays = 7) {
  // SameSite=None+Secure wymagane gdy frontend i API są na różnych subdomenach (cross-site)
  const base = { httpOnly: true, secure: !IS_DEV, sameSite: IS_DEV ? ('lax' as const) : ('none' as const) };
  res.cookie('access_token',  accessToken,  { ...base, path: '/',                   maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { ...base, path: '/api/v1/auth/refresh', maxAge: refreshDays * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token',  { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth:   AuthService,
    private azure:  AzureAuthService,
    private google: GoogleAuthService,
  ) {}

  // ── Email / password ─────────────────────────────────────────
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Login — sets httpOnly cookies, returns { user }' })
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const d = await this.auth.login(req.user);
    const refreshDays = d.user.role === UserRole.KIOSK ? 30 : 7;
    setAuthCookies(res, d.accessToken, d.refreshToken, refreshDays);
    return { user: d.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Rotate refresh token — reads from cookie, sets new cookies' })
  async refresh(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const rt = (req as any).cookies?.refresh_token ?? (req.body as any)?.refreshToken;
    if (!rt) throw new UnauthorizedException('Missing refresh token');
    const d = await this.auth.refresh(rt);
    const refreshDays = d.user.role === UserRole.KIOSK ? 30 : 7;
    setAuthCookies(res, d.accessToken, d.refreshToken, refreshDays);
    return { user: d.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle()
  @ApiOperation({ summary: 'Revoke refresh token and clear cookies' })
  async logout(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const rt = (req as any).cookies?.refresh_token ?? (req.body as any)?.refreshToken;
    if (rt) await this.auth.logout(rt);
    clearAuthCookies(res);
  }

  // ── Bieżący użytkownik (świeże enabledModules) ───────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Zwraca profil zalogowanego użytkownika z aktualnymi enabledModules' })
  me(@Request() req) {
    return this.auth.getMe(req.user.id);
  }

  // ── Zmiana hasła ──────────────────────────────────────────────
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Zmień hasło — wymaga podania aktualnego hasła' })
  changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  // ── Microsoft / Entra ID SSO ──────────────────────────────────
  @Post('azure')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Login przez Microsoft — sets httpOnly cookies, returns { user }' })
  async loginAzure(@Body() dto: AzureLoginDto, @Res({ passthrough: true }) res: Response) {
    const d = await this.azure.loginWithAzureToken(dto.idToken);
    const refreshDays = d.user.role === UserRole.KIOSK ? 30 : 7;
    setAuthCookies(res, d.accessToken, d.refreshToken, refreshDays);
    return { user: d.user };
  }

  @Get('azure/check')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Sprawdź czy SSO dostępne dla emaila/orgSlug (publiczny)' })
  checkAzure(
    @Query('email')   email?: string,
    @Query('orgSlug') orgSlug?: string,
  ) {
    return this.azure.checkSsoAvailable(orgSlug, email);
  }

  // ── Google Workspace SSO ──────────────────────────────────────
  /**
   * GET /auth/google/redirect
   * Przekierowuje do Google OAuth2 consent.
   * Endpoint jest w exclude list w main.ts (POZA /api/v1).
   * Wymaga JWT — orgId pobierany z tokenu.
   */
  @Get('google/redirect')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Rozpocznij Google OAuth2 dla org (JWT required)' })
  async googleRedirect(
    @Query('orgId')       orgId?:      string,
    @Query('redirectUrl') redirectUrl?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ): Promise<void> {
    const resolvedOrgId = req?.user?.organizationId ?? orgId;
    if (!resolvedOrgId) {
      res!.status(400).json({ message: 'orgId jest wymagany' });
      return;
    }
    try {
      const url = await this.google.buildRedirectUrl(resolvedOrgId, redirectUrl);
      res!.redirect(302, url);
    } catch (err: any) {
      res!.status(400).json({ message: err.message });
    }
  }

  /**
   * GET /auth/google/callback
   * Odbiera code od Google, wydaje JWT Reserti, redirect do frontendu.
   * Endpoint w exclude list (POZA /api/v1) — Google przekierowuje bez prefiksu.
   * Google redirect URI: https://api.prohalw2026.ovh/auth/google/callback
   */
  @Get('google/callback')
  @HttpCode(HttpStatus.FOUND)
  @SkipThrottle()
  @ApiOperation({ summary: 'Google OAuth2 callback — wymiana code na JWT Reserti' })
  async googleCallback(
    @Query('code')  code?:  string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL;

    if (error) {
      res!.redirect(`${frontendUrl}/login?error=google_denied`);
      return;
    }
    if (!code || !state) {
      res!.redirect(`${frontendUrl}/login?error=google_missing_params`);
      return;
    }

    try {
      const { exchangeCode, redirectUrl } = await this.google.handleCallback(code, state);
      // Exchange code (60s TTL) — frontend wymienia go przez POST /auth/google/exchange.
      // Token nigdy nie trafia do URL, historii przeglądarki ani rozszerzeń.
      res!.redirect(`${redirectUrl}/login?google_code=${exchangeCode}`);
    } catch (err: any) {
      const msg = encodeURIComponent(err.message ?? 'Błąd logowania');
      res!.redirect(`${frontendUrl}/login?error=google_auth&msg=${msg}`);
    }
  }

  // ── Invitation & self-registration ───────────────────────────

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Send invitation email to new user (ADMIN only)' })
  inviteUser(@Body() dto: InviteUserDto, @Request() req: any) {
    return this.auth.createInvitation({
      email:          dto.email,
      organizationId: req.user.organizationId,
      role:           dto.role ?? UserRole.END_USER,
      invitedById:    req.user.id,
      expiresInDays:  dto.expiresInDays,
    });
  }

  @Get('invitations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending (unused, non-expired) invitations for the org' })
  getPendingInvitations(@Request() req: any) {
    return this.auth.getPendingInvitations(req.user.organizationId);
  }

  @Get('invite/:token')
  @SkipThrottle()
  @ApiOperation({ summary: 'Verify invitation token — returns email + org name (public)' })
  getInviteInfo(@Param('token') token: string) {
    return this.auth.getInvitationInfo(token);
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Complete self-registration using invitation token (public)' })
  register(@Body() dto: RegisterDto) {
    return this.auth.completeRegistration(dto);
  }

  /**
   * GET /auth/google/check
   * Sprawdź czy Google SSO dostępne dla emaila — publiczny.
   */
  @Get('google/check')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Sprawdź czy Google SSO dostępne dla emaila (publiczny)' })
  checkGoogle(
    @Query('email')   email?:   string,
    @Query('orgSlug') orgSlug?: string,
  ) {
    return this.google.checkAvailable(email, orgSlug);
  }

  /**
   * POST /auth/google/exchange
   * Wymienia jednorazowy exchange code (60s TTL) na sesję Reserti.
   * Ustawia httpOnly cookies i zwraca { user } — identycznie jak /auth/login.
   * Code jest przechowywany server-side; token nigdy nie opuszcza backendu przez URL.
   *
   * SECURITY: access_token is NEVER returned in the response body — only set as
   * httpOnly cookie (path=/). refresh_token is httpOnly cookie (path=/api/v1/auth/refresh).
   * Frontend must NOT store tokens in localStorage — use cookies only.
   * TODO #BACKLOG-1: Add token binding (device fingerprint) to refresh tokens.
   */
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Wymień google_code na sesję Reserti (ustawia cookies)' })
  async exchangeGoogleCode(
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const code = body?.code;
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Missing code');
    }
    const { accessToken, refreshToken, user, role } = await this.google.exchangeCode(code);
    const refreshDays = role === UserRole.KIOSK ? 30 : 7;
    setAuthCookies(res, accessToken, refreshToken, refreshDays);
    return { user };
  }
}
