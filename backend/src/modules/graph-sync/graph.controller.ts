/**
 * GraphController — Sprint F (M4)
 *
 * GET  /auth/graph/redirect    — start OAuth2 dla Graph (wymaga zalogowania)
 * GET  /auth/graph/callback    — odbierz code, zapisz tokeny, redirect
 * POST /graph/webhook          — odbierz notyfikacje Microsoft Graph (publiczny!)
 * GET  /graph/status           — status połączenia Graph dla usera
 * POST /graph/subscribe        — utwórz webhook subskrypcję
 * DELETE /graph/disconnect     — odłącz Graph dla usera
 *
 * backend/src/modules/graph-sync/graph.controller.ts
 */
import {
  Controller, Get, Post, Delete, Query, Body, Headers,
  UseGuards, Request, HttpCode, HttpStatus, Res,
  BadRequestException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { Response }        from 'express';
import { SkipThrottle }    from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { GraphService }    from './graph.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NonceStoreService }  from '../auth/nonce-store.service';
import type { AzureEntraConfig } from '../integrations/types/integration-config.types';
import { randomBytes }     from 'crypto';
import { ConfigService }   from '@nestjs/config';

const GRAPH_SCOPES = 'Calendars.ReadWrite offline_access User.Read';

@ApiTags('graph-sync')
@Controller()
export class GraphController {
  private readonly logger = new Logger(GraphController.name);

  constructor(
    private readonly graphService:   GraphService,
    private readonly integrations:   IntegrationsService,
    private readonly config:         ConfigService,
    private readonly nonceStore:     NonceStoreService,
  ) {}

  // ── Krok 1: Redirect do Microsoft OAuth2 ────────────────────
  @Get('auth/graph/redirect')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rozpocznij autoryzację Microsoft Graph (Outlook Calendar)' })
  async graphRedirect(@Request() req: any, @Res() res: Response): Promise<void> {
    const userId = req.user.sub ?? req.user.id;
    const orgId  = req.user.organizationId;

    if (!orgId) {
      res.status(400).json({ message: 'Brak organizationId w tokenie' });
      return;
    }

    // Pobierz konfigurację Azure (BYOA lub globalna)
    const azureCfg = await this.integrations.getAzureConfig(orgId);
    if (!azureCfg?.tenantId) {
      res.status(400).json({
        message: 'Integracja Azure Entra ID nie jest skonfigurowana dla tej organizacji',
      });
      return;
    }

    const clientId = (azureCfg as any).clientId ?? this.config.get('AZURE_CLIENT_ID', '');
    if (!clientId) {
      res.status(400).json({ message: 'Brak Azure Client ID — skonfiguruj integrację Azure' });
      return;
    }

    // Generuj state (CSRF) — persisted in NonceStoreService (Redis or in-memory)
    const state = randomBytes(16).toString('hex');
    await this.nonceStore.set(state, { orgId, userId });

    const redirectUri = `${this.config.get('PUBLIC_API_URL')}/auth/graph/callback`;

    const params = new URLSearchParams({
      client_id:     clientId,
      response_type: 'code',
      redirect_uri:  redirectUri,
      response_mode: 'query',
      scope:         GRAPH_SCOPES,
      state,
      prompt:        'consent', // wymuś consent screen żeby dostać refresh_token
    });

    res.redirect(302, `https://login.microsoftonline.com/${azureCfg.tenantId}/oauth2/v2.0/authorize?${params.toString()}`);
  }

  // ── Krok 2: Callback od Microsoft ───────────────────────────
  @Get('auth/graph/callback')
  @HttpCode(HttpStatus.FOUND)
  @SkipThrottle()
  @ApiOperation({ summary: 'Callback OAuth2 Microsoft Graph — wymiana code na tokeny' })
  async graphCallback(
    @Query('code')  code:  string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL');

    if (error || !code || !state) {
      res.redirect(`${frontendUrl}/settings/integrations?graph_error=${encodeURIComponent(error ?? 'cancelled')}`);
      return;
    }

    // Waliduj state
    const entry = await this.nonceStore.get(state);
    if (!entry || entry.expiresAt < Date.now()) {
      res.redirect(`${frontendUrl}/settings/integrations?graph_error=state_expired`);
      return;
    }
    await this.nonceStore.delete(state);

    if (!entry.userId) {
      this.logger.warn(`graphCallback: state=${state} missing userId — re-auth required`);
      res.redirect(`${frontendUrl}/settings/integrations?graph_error=state_expired`);
      return;
    }
    const userId = entry.userId;
    const orgId  = entry.orgId;

    // Pobierz config Azure
    const azureCfg = await this.integrations.getAzureConfig(orgId);
    const clientId     = (azureCfg as any)?.clientId     ?? this.config.get('AZURE_CLIENT_ID', '');
    const clientSecret = (azureCfg as any)?.clientSecret  ?? this.config.get('AZURE_CLIENT_SECRET', '');
    const tenantId     = azureCfg?.tenantId ?? 'common';

    const redirectUri = `${this.config.get('PUBLIC_API_URL')}/auth/graph/callback`;

    try {
      // Wymień code na tokeny
      const body = new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        scope:         GRAPH_SCOPES,
      });

      const tokenResp = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(10_000) },
      );

      if (!tokenResp.ok) {
        const err = await tokenResp.json().catch(() => ({})) as any;
        this.logger.warn(`Graph token exchange failed: ${err.error_description}`);
        res.redirect(`${frontendUrl}/settings/integrations?graph_error=${encodeURIComponent(err.error_description ?? 'token_error')}`);
        return;
      }

      const tokens = await tokenResp.json() as any;

      // Zapisz tokeny
      await this.graphService.saveTokens(
        userId, orgId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in ?? 3600,
      );

      // Utwórz subskrypcję webhook
      await this.graphService.createSubscription(userId).catch(() => {
        this.logger.warn(`Graph subscription creation failed for user=${userId} (non-fatal)`);
      });

      this.logger.log(`Graph connected for user=${userId} org=${orgId}`);
      res.redirect(`${frontendUrl}/settings/integrations?graph_connected=1`);
    } catch (err: any) {
      this.logger.error(`Graph callback error: ${err.message}`);
      res.redirect(`${frontendUrl}/settings/integrations?graph_error=${encodeURIComponent(err.message)}`);
    }
  }

  // ── Webhook od Microsoft Graph (publiczny endpoint) ──────────
  /**
   * POST /graph/webhook
   *
   * Microsoft wysyła tutaj notyfikacje o zmianach w kalendarzu.
   * Musi odpowiedzieć 202 Accepted NATYCHMIAST (< 3s).
   * Walidacja odbywa się przez clientState.
   *
   * Spec: https://learn.microsoft.com/graph/webhooks
   */
  @Post('graph/webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  @SkipThrottle()
  @ApiOperation({ summary: 'Microsoft Graph webhook — odbierz notyfikacje kalendarza' })
  async graphWebhook(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    // Microsoft wysyła validationToken przy rejestracji subskrypcji
    // — odpowiedz plaintext z tym samym tokenem
    if (validationToken) {
      res.setHeader('Content-Type', 'text/plain');
      return validationToken;
    }

    // Przetwarzaj notyfikacje w tle — nie blokuj odpowiedzi
    const notifications: any[] = body?.value ?? [];
    if (notifications.length > 0) {
      this.graphService.processWebhookNotification(notifications).catch(err => {
        this.logger.error(`Webhook processing error: ${err.message}`);
      });
    }

    return { status: 'accepted' };
  }

  // ── Status połączenia ────────────────────────────────────────
  @Get('graph/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Status połączenia Microsoft Graph dla aktualnego usera' })
  async graphStatus(@Request() req: any) {
    const userId = req.user.sub ?? req.user.id;
    const isConnected = await this.graphService.isConnected(userId);

    if (!isConnected) return { connected: false };

    // Sprawdź czy token ważny
    const token = await this.graphService.getAccessToken(userId);
    return {
      connected:    true,
      tokenValid:   !!token,
    };
  }

  // ── Ręczne utworzenie subskrypcji ───────────────────────────
  @Post('graph/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Utwórz webhook subskrypcję Graph dla aktualnego usera' })
  async graphSubscribe(@Request() req: any) {
    const userId = req.user.sub ?? req.user.id;
    const ok = await this.graphService.createSubscription(userId);
    return { ok, message: ok ? 'Subskrypcja utworzona' : 'Błąd tworzenia subskrypcji' };
  }

  // ── Disconnect ───────────────────────────────────────────────
  @Delete('graph/disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Odłącz Microsoft Graph (usuń tokeny i subskrypcje)' })
  async graphDisconnect(@Request() req: any) {
    const userId = req.user.sub ?? req.user.id;
    await this.graphService.disconnectUser(userId);
    return { disconnected: true };
  }
}
