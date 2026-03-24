import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import {
  TOPICS,
  extractDeskId,
  extractGatewayId,
  LED_COMMANDS,
  LedState,
  UserEventPayload,
  BroadcastPayload,
} from './topics';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private readonly logger = new Logger(MqttService.name);

  private onCheckin:      ((deskId: string, payload: any) => void) | null = null;
  private onStatus:       ((deskId: string, payload: any) => void) | null = null;
  private onGatewayHello: ((gwId: string,   payload: any) => void) | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL', 'mqtt://localhost:1883');

    this.client = mqtt.connect(brokerUrl, {
      username:        this.config.get('MQTT_USERNAME'),
      password:        this.config.get('MQTT_PASSWORD'),
      clientId:        `server-${Date.now()}`,
      reconnectPeriod: 3000,
      connectTimeout:  10_000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      this._subscribeAll();
    });

    this.client.on('message', (topic, raw) => this._handleMessage(topic, raw));
    this.client.on('error',     err => this.logger.error('MQTT error', err.message));
    this.client.on('reconnect', ()  => this.logger.warn('MQTT reconnecting...'));
    this.client.on('offline',   ()  => this.logger.warn('MQTT offline'));
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  // ── Subscribe to all incoming beacon / gateway topics ──────
  private _subscribeAll() {
    const topics = [
      TOPICS.ALL_CHECKINS,
      TOPICS.ALL_STATUS,
      TOPICS.ALL_QR_SCANS,
      TOPICS.ALL_GW_HELLO,
      TOPICS.ALL_GW_HB,
    ];
    this.client.subscribe(topics, { qos: 1 }, err => {
      if (err) this.logger.error('Subscribe error', err);
      else this.logger.log(`Subscribed to ${topics.length} topic patterns`);
    });
  }

  // ── Route incoming messages ─────────────────────────────────
  private _handleMessage(topic: string, raw: Buffer) {
    let payload: any;
    try   { payload = JSON.parse(raw.toString()); }
    catch { payload = raw.toString(); }

    const deskId = extractDeskId(topic);
    const gwId   = extractGatewayId(topic);

    if (deskId && topic.endsWith('/checkin') && this.onCheckin)
      this.onCheckin(deskId, payload);
    else if (deskId && topic.endsWith('/status') && this.onStatus)
      this.onStatus(deskId, payload);
    else if (gwId && this.onGatewayHello)
      this.onGatewayHello(gwId, payload);
  }

  // ── Generic publish ─────────────────────────────────────────
  publish(topic: string, payload: object, qos: 0 | 1 | 2 = 1, retain = false) {
    this.client.publish(topic, JSON.stringify(payload), { qos, retain }, err => {
      if (err) this.logger.error(`Publish failed → ${topic}`, err.message);
    });
  }

  // ── Send LED command to a specific desk beacon ──────────────
  sendLedCommand(deskId: string, state: LedState) {
    const cmd = LED_COMMANDS[state];
    this.publish(TOPICS.COMMAND(deskId), cmd);
    this.logger.debug(`LED → desk/${deskId}: ${state}`);
  }

  // ── Send event to a specific user (mobile / PWA) ───────────
  notifyUser(userId: string, event: UserEventPayload) {
    this.publish(TOPICS.USER_EVENT(userId), event, 1);
    this.logger.debug(`User event → user/${userId}: ${event.type}`);
  }

  // ── System-wide broadcast ───────────────────────────────────
  broadcast(payload: BroadcastPayload) {
    this.publish(TOPICS.BROADCAST, payload, 0);   // QoS 0 — best effort
    this.logger.log(`Broadcast: ${payload.type} — ${payload.message}`);
  }

  // ── Handler registration ────────────────────────────────────
  registerCheckinHandler(fn: (deskId: string, payload: any) => void) {
    this.onCheckin = fn;
  }

  registerStatusHandler(fn: (deskId: string, payload: any) => void) {
    this.onStatus = fn;
  }

  registerGatewayHelloHandler(fn: (gwId: string, payload: any) => void) {
    this.onGatewayHello = fn;
  }
}
