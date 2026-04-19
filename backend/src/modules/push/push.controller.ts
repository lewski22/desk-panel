import { Controller, Get, Post, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService } from './push.service';
@ApiTags('push') @Controller('push') @UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private svc: PushService) {}
  @Get('vapid-key') getKey() { return {publicKey:this.svc.vapidPublicKey}; }
  @Post('subscribe') subscribe(@Body() dto: any, @Request() req: any) { return this.svc.subscribe(req.user.id,dto); }
  @Delete('unsubscribe') unsubscribe(@Body('endpoint') ep: string, @Request() req: any) { return this.svc.unsubscribe(req.user.id,ep); }
}
