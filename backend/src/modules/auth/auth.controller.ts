import {
  Controller, Post, Patch, Get, Body, Query, Param,
  UseGuards, Request, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response }             from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard }            from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService }          from './auth.service';
import { AzureAuthService }     from './azure-auth.service';
import { GoogleAuthService }    from './google-auth.service';
import { RefreshTokenDto }      from './dto/refresh-token.dto';
import { AzureLoginDto }        from './dto/azure-login.dto';
import { ChangePasswordDto }    from './dto/change-password.dto';
import { InviteUserDto }        from './dto/invite-user.dto';
import { RegisterDto }          from './dto/register.dto';
import { JwtAuthGuard }         from './guards/jwt-auth.guard';
import { RolesGuard }           from './guards/roles.guard';
import { Roles }                from './decorators/roles.decorator';
import { UserRole }             from '@prisma/client';

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
  @ApiOperation({ summary: 'Login przez Microsoft — wymiana idToken na JWT Reserti' })
  loginAzure(@Body() dto: AzureLoginDto) {
    return this.azure.loginWithAzureToken(dto.idToken);
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
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://staff.prohalw2026.ovh';

    if (error) {
      res!.redirect(`${frontendUrl}/login?error=google_denied`);
      return;
    }
    if (!code || !state) {
      res!.redirect(`${frontendUrl}/login?error=google_missing_params`);
      return;
    }

    try {
      const { accessToken, redirectUrl } = await this.google.handleCallback(code, state);
      // Token w hash — nie trafia do server logs
      res!.redirect(`${redirectUrl}/login#google_token=${accessToken}`);
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
}
