import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService } from './mqtt.service'; import { CheckinsService } from '../modules/checkins/checkins.service';
import { GatewaysService } from '../modules/gateways/gateways.service'; import { LedEventsService } from '../shared/led-events.service';
import { PrismaService } from '../database/prisma.service'; import { LED_PAYLOADS } from './topics';
@Injectable()
export class MqttHandlers implements OnModuleInit {
  private readonly logger = new Logger(MqttHandlers.name);

  // Debounce + sequence per desk — chroni przed race condition przy szybkich zmianach statusów
  private readonly _ledTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _ledSeq    = new Map<string, number>();
  private readonly LED_DEBOUNCE_MS = 150;

  constructor(private mqtt: MqttService, private checkins: CheckinsService, private gateways: GatewaysService, private ledEvents: LedEventsService, private prisma: PrismaService) {}

  onModuleInit() {
    this.mqtt.registerCheckinHandler(this.handleCheckin.bind(this));
    this.mqtt.registerStatusHandler(this.handleStatus.bind(this));
    this.mqtt.registerGatewayHelloHandler(this.handleGatewayHello.bind(this));
    this.ledEvents.events$.subscribe(({deskId, state}) => {
      // Anuluj poprzedni oczekujący timer dla tego biurka
      const prev = this._ledTimers.get(deskId);
      if (prev) clearTimeout(prev);

      // Nadaj nowy numer sekwencji — in-flight komendy ze starszym numerem zostaną zignorowane
      const seq = (this._ledSeq.get(deskId) ?? 0) + 1;
      this._ledSeq.set(deskId, seq);

      const timer = setTimeout(async () => {
        this._ledTimers.delete(deskId);
        try {
          if (this._ledSeq.get(deskId) !== seq) return; // nowsza komenda już w kolejce

          const gwId = await this.gateways.findGatewayForDesk(deskId);
          if (!gwId || this._ledSeq.get(deskId) !== seq) return;

          const basePayload = LED_PAYLOADS[state];
          if (!basePayload) return;

          const desk = await this.prisma.desk.findUnique({
            where:  { id: deskId },
            select: { location: { select: { ledBrightness: true, ledColorFree: true, ledColorReserved: true, ledColorOccupied: true, ledColorGuestReserved: true } } },
          });
          if (this._ledSeq.get(deskId) !== seq) return; // sprawdź po async DB

          const loc = desk?.location;
          const brightness = loc?.ledBrightness ?? 100;
          let color = basePayload.params.color;
          if (loc) {
            if      (state === 'FREE')           color = loc.ledColorFree;
            else if (state === 'RESERVED')       color = loc.ledColorReserved;
            else if (state === 'OCCUPIED')       color = loc.ledColorOccupied;
            else if (state === 'GUEST_RESERVED') color = loc.ledColorGuestReserved;
            else if (state === 'ERROR')          color = loc.ledColorOccupied ?? '#DC0000';
          }

          await this.gateways.sendBeaconCommand(gwId, deskId, 'SET_LED', { ...basePayload.params, color, brightness });
        } catch (e) { this.logger.error(`LED send failed for desk ${deskId}: ${e}`); }
      }, this.LED_DEBOUNCE_MS);

      this._ledTimers.set(deskId, timer);
    });
  }
  private readonly ERROR_RESTORE_MS = 3_000;

  private async handleCheckin(deskId: string, payload: any) {
    try {
      const r = await this.checkins.checkinNfc(deskId, payload.card_uid, payload.gateway_id, payload.device_id);
      if (r.authorized) {
        this.ledEvents.emit(deskId, 'OCCUPIED');
      } else {
        this.ledEvents.emit(deskId, 'ERROR');
        setTimeout(() => this.gateways.restoreDeskLed(deskId).catch(() => {}), this.ERROR_RESTORE_MS);
      }
    } catch {
      this.ledEvents.emit(deskId, 'ERROR');
      setTimeout(() => this.gateways.restoreDeskLed(deskId).catch(() => {}), this.ERROR_RESTORE_MS);
    }
  }
  private async handleStatus(deskId: string, payload: any) {
    if (payload.device_id) {
      await this.gateways.deviceHeartbeat(
        payload.device_id,
        payload.rssi,
        payload.fw_version,
      ).catch(() => {});
    }

    // Beacon po restarcie prosi o retransmit stanu LED (request_sync=true).
    // Backend jest source of truth — wysyła aktualny stan z bazy.
    if (payload.request_sync && deskId) {
      await this.gateways.restoreDeskLed(deskId).catch(() => {});
    }
  }
  private async handleGatewayHello(gwId: string, payload: any) {
    await this.gateways.heartbeat(gwId,payload.ip_address,payload.version).catch(()=>{});
  }
}
