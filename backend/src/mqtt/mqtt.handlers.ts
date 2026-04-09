import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService }     from './mqtt.service';
import { CheckinsService }  from '../modules/checkins/checkins.service';
import { GatewaysService }  from '../modules/gateways/gateways.service';
import { MetricsService }    from '../metrics/metrics.service';
import { LedEventsService } from '../shared/led-events.service';
import { TOPICS } from './topics';
import { PrismaService }    from '../database/prisma.service';

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
    private metrics:   MetricsService,
    private prisma:    PrismaService,
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
    this.metrics?.incrementMqttReceived('status');
    const { device_id, rssi, fw_version, request_sync } = payload;
    if (!device_id) return;

    try {
      await this.gateways.deviceHeartbeat(device_id, rssi, fw_version);
    } catch {
      // device not provisioned yet — ignore
    }

    // Bug fix #1 — po restarcie beacon wysyła request_sync=true
    // Odpowiadamy SET_RESERVATION z aktualną/nadchodzącą rezerwacją
    if (request_sync) {
      await this._sendReservationSync(deskId);
    }
  }

  /**
   * Wysyła SET_RESERVATION do beacona z czasami aktualnej lub nadchodzącej rezerwacji.
   * Wywoływane gdy beacon (re)łączy się z MQTT (request_sync=true w heartbeat).
   * Beacon używa tych czasów do lokalnego timera: FREE→RESERVED 15 min przed startem,
   * RESERVED→FREE po upływie endTime.
   */
  private async _sendReservationSync(deskId: string) {
    try {
      const now  = new Date();
      // Okno: 1h wstecz (dla trwających rezerwacji) do 16h w przód (pre-reservation window)
      const from = new Date(now.getTime() - 60 * 60 * 1000);
      const to   = new Date(now.getTime() + 16 * 60 * 60 * 1000);

      const reservation = await this.prisma.reservation.findFirst({
        where: {
          deskId,
          status:    { in: ['CONFIRMED', 'PENDING'] },
          endTime:   { gte: now },     // nie wygasła
          startTime: { lte: to },      // zaczyna się w ciągu 16h
        },
        orderBy: { startTime: 'asc' },
      });

      const gatewayId = await this.gateways.findGatewayForDesk(deskId);
      if (!gatewayId) return;

      if (reservation) {
        const startUnix = Math.floor(reservation.startTime.getTime() / 1000);
        const endUnix   = Math.floor(reservation.endTime.getTime()   / 1000);

        await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_RESERVATION', {
          start_unix: startUnix,
          end_unix:   endUnix,
        });
        this.logger.debug(
          `Sync → desk/${deskId}: SET_RESERVATION start=${startUnix} end=${endUnix}`
        );
      } else {
        // Brak rezerwacji — beacon wraca do FREE i wyłącza lokalny timer
        await this.gateways.sendBeaconCommand(gatewayId, deskId, 'SET_RESERVATION', {
          start_unix: 0,
          end_unix:   0,
        });
        this.logger.debug(`Sync → desk/${deskId}: SET_RESERVATION (none)`);
      }
    } catch (err: any) {
      this.logger.warn(`Reservation sync failed for desk/${deskId}: ${err.message}`);
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
