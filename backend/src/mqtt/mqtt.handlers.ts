import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { CheckinsService } from '../modules/checkins/checkins.service';
import { DevicesService }  from '../modules/devices/devices.service';
import { GatewaysService } from '../modules/gateways/gateways.service';
import { UserEventPayload } from './topics';

@Injectable()
export class MqttHandlers implements OnModuleInit {
  private readonly logger = new Logger(MqttHandlers.name);

  constructor(
    private mqtt:     MqttService,
    private checkins: CheckinsService,
    private devices:  DevicesService,
    private gateways: GatewaysService,
  ) {}

  onModuleInit() {
    this.mqtt.registerCheckinHandler(this.handleCheckin.bind(this));
    this.mqtt.registerStatusHandler(this.handleStatus.bind(this));
    this.mqtt.registerGatewayHelloHandler(this.handleGatewayHello.bind(this));
  }

  // ── desk/{deskId}/checkin ───────────────────────────────────
  // Payload per spec: event_id, type, device_id, desk_id,
  //                   timestamp, method, offline, card_uid, rssi
  private async handleCheckin(deskId: string, payload: any) {
    const { card_uid, device_id, offline = false, event_id } = payload;

    this.logger.log(`NFC scan`, {
      deskId,
      cardUid: card_uid,
      offline,
      eventId: event_id,
    });

    try {
      const result = await this.checkins.checkinNfc(deskId, card_uid, device_id ?? '');

      if (result.authorized) {
        this.mqtt.sendLedCommand(deskId, 'OCCUPIED');
        this.logger.log(`Check-in OK: desk=${deskId}`, { offline });

        // Notify user via their personal MQTT topic
        if (result.checkin) {
          const event: UserEventPayload = {
            type:     'checkin_confirmed',
            userId:   result.checkin.userId,
            deskId,
            deskName: payload.desk_name,
            ts:       Date.now(),
          };
          this.mqtt.notifyUser(result.checkin.userId, event);
        }
      } else {
        this.mqtt.sendLedCommand(deskId, 'DENIED');
        this.logger.warn(`Check-in DENIED: desk=${deskId}`, { reason: result.reason, offline });

        // Optionally notify the user that access was denied
        if (result.userId) {
          this.mqtt.notifyUser(result.userId, {
            type:    'checkin_denied',
            userId:  result.userId,
            deskId,
            message: result.reason,
            ts:      Date.now(),
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Check-in error: desk=${deskId}`, err.message);
      this.mqtt.sendLedCommand(deskId, 'ERROR');
    }
  }

  // ── desk/{deskId}/status (heartbeat from beacon) ────────────
  // Payload per spec: device_id, status, uptime, rssi, fw_version
  private async handleStatus(deskId: string, payload: any) {
    const { device_id, rssi, fw_version } = payload;
    if (!device_id) return;

    try {
      const device = await this.devices.heartbeat(device_id, rssi);

      // Update firmware version if reported
      if (fw_version && device && device.firmwareVersion !== fw_version) {
        await this.devices.updateFirmwareVersion(device_id, fw_version);
      }
    } catch {
      // Device may not yet be provisioned — ignore
    }
  }

  // ── gateway/{gwId}/hello ────────────────────────────────────
  private async handleGatewayHello(gwId: string, payload: any) {
    this.logger.log(`Gateway online: ${gwId}`);
    try {
      await this.gateways.heartbeat(gwId, payload?.ip_address);
    } catch (err: any) {
      this.logger.error(`Gateway heartbeat error: ${gwId}`, err.message);
    }
  }
}
