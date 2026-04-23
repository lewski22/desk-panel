import { Controller, Get, Post, Delete, Body, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService }        from './push.service';
import { PushSubscribeDto } from './dto/push-subscribe.dto';

@ApiTags('push')
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private svc: PushService) {}

  @Get('vapid-key')
  getKey() { return { publicKey: this.svc.vapidPublicKey }; }

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
