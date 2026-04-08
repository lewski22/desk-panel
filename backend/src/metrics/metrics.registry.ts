/**
 * MetricsRegistry — singletony metryk Prometheus.
 *
 * Wszystkie metryki zdefiniowane w jednym miejscu, importowane
 * przez serwisy i interceptory. Rejestr domyślny prom-client
 * zbiera też Node.js process metrics automatycznie.
 *
 * GRUPY:
 *   HTTP_*        — każde zapytanie HTTP do API
 *   DB_*          — każde zapytanie Prisma
 *   MQTT_*        — wiadomości MQTT (in/out)
 *   OWNER_*       — agregaty globalne (cron 30s) — dla operatora platformy
 *   CLIENT_*      — agregaty per org/location (cron 60s) — dla klienta
 */
import {
  Counter, Histogram, Gauge,
  register, collectDefaultMetrics,
} from 'prom-client';

// Zbieraj Node.js process metrics (CPU, memory, event loop lag)
collectDefaultMetrics({ register });

// ── HTTP ──────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name:    'reserti_http_request_duration_seconds',
  help:    'Czas odpowiedzi HTTP [s]',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new Counter({
  name:    'reserti_http_requests_total',
  help:    'Liczba żądań HTTP',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpErrorsTotal = new Counter({
  name:    'reserti_http_errors_total',
  help:    'Błędy HTTP (4xx, 5xx)',
  labelNames: ['route', 'status_code'],
});

// ── Baza danych (Prisma) ──────────────────────────────────────
export const dbQueryDuration = new Histogram({
  name:    'reserti_db_query_duration_seconds',
  help:    'Czas zapytania Prisma [s]',
  labelNames: ['model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
});

export const dbErrorsTotal = new Counter({
  name:    'reserti_db_errors_total',
  help:    'Błędy zapytań Prisma',
  labelNames: ['model', 'operation'],
});

// ── MQTT ─────────────────────────────────────────────────────
export const mqttMessagesReceived = new Counter({
  name:    'reserti_mqtt_messages_received_total',
  help:    'Wiadomości MQTT odebrane przez backend',
  labelNames: ['topic_type'],  // checkin | status | qr_scan | heartbeat
});

export const mqttMessagesPublished = new Counter({
  name:    'reserti_mqtt_messages_published_total',
  help:    'Wiadomości MQTT wysłane przez backend do beaconów',
  labelNames: ['topic_type'],  // led_command | ota_update | set_desk_id
});

export const mqttErrorsTotal = new Counter({
  name:    'reserti_mqtt_errors_total',
  help:    'Błędy MQTT',
  labelNames: ['direction'],   // in | out
});

// ── Owner — agregaty globalne ─────────────────────────────────
export const ownerOrgsTotal = new Gauge({
  name:    'reserti_organizations_total',
  help:    'Liczba organizacji',
  labelNames: ['status'],  // active | inactive
});

export const ownerGatewaysTotal = new Gauge({
  name:    'reserti_gateways_total',
  help:    'Liczba gatewayów',
  labelNames: ['status'],  // online | offline
});

export const ownerBeaconsTotal = new Gauge({
  name:    'reserti_beacons_total',
  help:    'Liczba beaconów',
  labelNames: ['status'],  // online | offline
});

export const ownerBeaconsFwOutdated = new Gauge({
  name:    'reserti_beacons_firmware_outdated_total',
  help:    'Beacony z nieaktualnym firmware (per org)',
  labelNames: ['org_id'],
});

export const ownerProvisioningErrors = new Gauge({
  name:    'reserti_provisioning_errors_24h_total',
  help:    'UNAUTHORIZED_SCAN eventy z ostatnich 24h (per org)',
  labelNames: ['org_id'],
});

// ── Client — per org/location ────────────────────────────────
export const clientDesksTotal = new Gauge({
  name:    'reserti_desks_total',
  help:    'Liczba biurek',
  labelNames: ['org_id', 'location_id', 'status'],  // active | inactive
});

export const clientDesksOccupied = new Gauge({
  name:    'reserti_desks_occupied_now',
  help:    'Biurka z aktywnym check-inem teraz',
  labelNames: ['org_id', 'location_id'],
});

export const clientReservationsToday = new Gauge({
  name:    'reserti_reservations_today_total',
  help:    'Rezerwacje dzisiaj (per status)',
  labelNames: ['org_id', 'location_id', 'status'],
});

export const clientCheckinsTotal = new Counter({
  name:    'reserti_checkins_total',
  help:    'Check-iny (NFC/QR/MANUAL)',
  labelNames: ['org_id', 'location_id', 'method'],
});

export const clientCheckoutsTotal = new Counter({
  name:    'reserti_checkouts_total',
  help:    'Check-outy',
  labelNames: ['org_id', 'location_id'],
});

export const clientUnauthorizedScans = new Counter({
  name:    'reserti_unauthorized_scans_total',
  help:    'Nieznane karty NFC (card_not_registered)',
  labelNames: ['org_id', 'gateway_id'],
});

export const clientBeaconRssi = new Gauge({
  name:    'reserti_beacon_rssi_dbm',
  help:    'RSSI beacona [dBm]',
  labelNames: ['org_id', 'location_id', 'device_id'],
});

export const clientBeaconLastSeen = new Gauge({
  name:    'reserti_beacon_last_seen_seconds',
  help:    'Sekundy od ostatniego heartbeatu beacona',
  labelNames: ['org_id', 'location_id', 'device_id'],
});

export const clientGatewayLastSeen = new Gauge({
  name:    'reserti_gateway_last_seen_seconds',
  help:    'Sekundy od ostatniego heartbeatu gateway',
  labelNames: ['org_id', 'gateway_id'],
});

export const clientGatewayVersionInfo = new Gauge({
  name:    'reserti_gateway_version_info',
  help:    'Wersja software gateway (info metric, wartość zawsze 1)',
  labelNames: ['org_id', 'gateway_id', 'version'],
});

export { register };
