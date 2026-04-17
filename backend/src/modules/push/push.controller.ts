/**
 * PushController — Sprint G2
 * Endpointy do zarządzania push subskrypcjami
 */
import {
  Controller, Post, Delete, Get,
  Body, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService }  from './push.service';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('push-vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for service worker registration' })
  getVapidKey() {
    return { publicKey: this.push.vapidPublicKey };
  }

  @Post('push-subscription')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a PWA push subscription' })
  subscribe(
    @Body() body: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
    @Request() req: any,
  ) {
    return this.push.subscribe(req.user.id, body);
  }

  @Delete('push-subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister a push subscription (opt-out)' })
  unsubscribe(
    @Body() body: { endpoint: string },
    @Request() req: any,
  ) {
    return this.push.unsubscribe(req.user.id, body.endpoint);
  }
}
