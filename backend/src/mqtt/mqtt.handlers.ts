import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService } from './mqtt.service'; import { CheckinsService } from '../modules/checkins/checkins.service';
import { GatewaysService } from '../modules/gateways/gateways.service'; import { LedEventsService } from '../shared/led-events.service';
import { PrismaService } from '../database/prisma.service'; import { LED_PAYLOADS } from './topics';
@Injectable()
export class MqttHandlers implements OnModuleInit {
  private readonly logger = new Logger(MqttHandlers.name);
  constructor(private mqtt: MqttService, private checkins: CheckinsService, private gateways: GatewaysService, private ledEvents: LedEventsService, private prisma: PrismaService) {}
  onModuleInit() {
    this.mqtt.registerCheckinHandler(this.handleCheckin.bind(this));
    this.mqtt.registerStatusHandler(this.handleStatus.bind(this));
    this.mqtt.registerGatewayHelloHandler(this.handleGatewayHello.bind(this));
    this.ledEvents.events$.subscribe(async ({deskId,state})=>{
      try { const gwId=await this.gateways.findGatewayForDesk(deskId); if(!gwId)return;
        await this.gateways.sendBeaconCommand(gwId,deskId,'SET_LED',LED_PAYLOADS[state]?.params); } catch{}});
  }
  private async handleCheckin(deskId: string, payload: any) {
    try { const r=await this.checkins.checkinNfc(deskId,payload.card_uid,payload.gateway_id,payload.device_id);
      this.ledEvents.emit(deskId,r.authorized?'OCCUPIED':'ERROR'); } catch{ this.ledEvents.emit(deskId,'ERROR'); }
  }
  private async handleStatus(deskId: string, payload: any) {
    if(payload.device_id) await this.gateways.deviceHeartbeat(payload.device_id,payload.rssi,payload.fw_version).catch(()=>{});
  }
  private async handleGatewayHello(gwId: string, payload: any) {
    await this.gateways.heartbeat(gwId,payload.ip_address,payload.version).catch(()=>{});
  }
}
