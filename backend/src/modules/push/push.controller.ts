import { Controller, Get, Post, Delete, Body, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';
import { UserRole }     from '@prisma/client';
import { PushService }        from './push.service';
import { PushSubscribeDto } from './dto/push-subscribe.dto';

@ApiTags('push')
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private svc: PushService) {}

  @Get('vapid-key')
  getKey() { return { publicKey: this.svc.vapidPublicKey }; }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Push diagnostics — VAPID status & subscription count' })
  async stats() {
    const vapidOk = !!this.svc.vapidPublicKey;
    const total   = await this.svc.countSubscriptions();
    return {
      vapidConfigured:    vapidOk,
      totalSubscriptions: total,
      message: vapidOk
        ? `Push działa. ${total} aktywnych subskrypcji.`
        : 'VAPID keys nie są skonfigurowane — push wyłączony.',
    };
  }

  @Post('subscribe')
  subscribe(@Body() dto: PushSubscribeDto, @Request() req: any) {
    return this.svc.subscribe(req.user.id, dto);
  }

  @Delete('unsubscribe')
  unsubscribe(@Body('endpoint') ep: string, @Request() req: any) {
    return this.svc.unsubscribe(req.user.id, ep);
  }

  @Post('test-send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test push to the current user — verifies VAPID & SW end-to-end' })
  async testSend(@Request() req: any) {
    await this.svc.notifyUser(req.user.id, {
      title: 'Reserti — test push',
      body:  'Powiadomienia push działają poprawnie.',
      url:   '/my-reservations',
    });
    return { sent: true };
  }
}
