import {
  Controller, Post, Get, Body, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard }        from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService }      from './auth.service';
import { AzureAuthService } from './azure-auth.service';
import { RefreshTokenDto }  from './dto/refresh-token.dto';
import { AzureLoginDto }    from './dto/azure-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth:  AuthService,
    private azure: AzureAuthService,
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
  @SkipThrottle()  // logout nie potrzebuje limitu
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
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
