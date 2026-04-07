import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService }     from './mqtt.service';
import { CheckinsService }  from '../modules/checkins/checkins.service';
import { GatewaysService }  from '../modules/gateways/gateways.service';
import { LedEventsService } from '../shared/led-events.service';
import { TOPICS } from './topics';

const LED_COLORS: Record<string, object> = {
  OCCUPIED: { command: 'SET_LED', params: { color: '#DC0000', animation: 'solid' } },
  FREE:     { command: 'SET_LED', params: { color: '#00C800', animation: 'solid' } },
  RESERVED: { command: 'SET_LED', params: { color: '#0050DC', animation: 'solid' } },
  ERROR:    { command: 'SET_LED', params: { color: '#DC0000', animation: 'blink' } },
};

@Injectable()
export class MqttHandlers implements OnModuleInit {
  private readonly logger = new Logger(MqttHandlers.name);

  constructor(
    private mqtt:      MqttService,
    private checkins:  CheckinsService,
    private gateways:  GatewaysService,
    private ledEvents: LedEventsService,
  ) {}

  onModuleInit() {
    this.mqtt.registerCheckinHandler(this.handleCheckin.bind(this));
    this.mqtt.registerStatusHandler(this.handleStatus.bind(this));
    this.mqtt.registerGatewayHelloHandler(this.handleGatewayHello.bind(this));

    // Nasłuchuj zdarzeń LED — wyślij przez gateway HTTP API (nie lokalny MQTT)
    // Backend i beacony mają osobne brokery MQTT. Jedyna droga: backend→gateway HTTP→Pi Mosquitto→beacon
    this.ledEvents.events$.subscribe(async ({ deskId, state }) => {
      try {
        // Znajdź gateway dla tego biurka i wyślij komendę przez HTTP
        const gatewayId = await this.gateways.findGatewayForDesk(deskId);
        if (!gatewayId) {
          this.logger.debug(`LED event: brak beacona dla desk/${deskId} — pomijam`);
          return;
        }

        const params = LED_COLORS[state] ? (LED_COLORS[state] as any).params : undefined;
        await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_LED', params);
        this.logger.debug(`LED → gateway → desk/${deskId}: ${state}`);
      } catch (err: any) {
        this.logger.debug(`LED event error: ${err.message}`);
      }
    });
  }

  private async handleCheckin(deskId: string, payload: any) {
    const { card_uid, device_id, offline = false, event_id } = payload;
    this.logger.log('NFC scan', { deskId, cardUid: card_uid, offline, eventId: event_id });

    try {
      const result = await this.checkins.checkinNfc(deskId, card_uid, device_id ?? '');

      if (result.authorized) {
        // Emituj przez LedEventsService → gateway HTTP → Pi Mosquitto → beacon
        // (nie mqtt.publish — backend i Pi mają osobne brokery Mosquitto)
        this.ledEvents.emit(deskId, 'OCCUPIED');
        this.logger.log(`Check-in OK: desk=${deskId}`, { offline });
      } else {
        this.ledEvents.emit(deskId, 'ERROR');
        this.logger.warn(`Check-in DENIED: desk=${deskId}`, { reason: result.reason });
      }
    } catch (err: any) {
      this.logger.error(`Check-in error: desk=${deskId}`, err.message);
      this.ledEvents.emit(deskId, 'ERROR');
    }
  }

  private async handleStatus(deskId: string, payload: any) {
    const { device_id, rssi, fw_version } = payload;
    if (!device_id) return;

    try {
      await this.gateways.deviceHeartbeat(device_id, rssi, fw_version);
    } catch {
      // device not provisioned yet — ignore
    }
  }

  private async handleGatewayHello(gwId: string, payload: any) {
    this.logger.log(`Gateway online: ${gwId}`);
    try {
      await this.gateways.heartbeat(gwId, payload?.ip_address);
    } catch (err: any) {
      this.logger.error(`Gateway heartbeat error: ${gwId}`, err.message);
    }
  }
}
