// MQTT topic patterns — Desk Beacon System
// Use builder helpers — never construct strings manually.

export const TOPICS = {
  // ── Beacon → Gateway → Server ─────────────────────────────
  CHECKIN: (deskId: string) => `desk/${deskId}/checkin`,
  STATUS:  (deskId: string) => `desk/${deskId}/status`,
  QR_SCAN: (deskId: string) => `desk/${deskId}/qr_scan`,

  // ── Server → Beacon (via gateway) ─────────────────────────
  COMMAND: (deskId: string) => `desk/${deskId}/command`,
  CONFIG:  (deskId: string) => `desk/${deskId}/config`,

  // ── Per-user push events (server → mobile / PWA) ──────────
  USER_EVENT: (userId: string) => `user/${userId}/event`,

  // ── System broadcast (server → all subscribers) ───────────
  BROADCAST: 'system/broadcast',

  // ── Gateway lifecycle ─────────────────────────────────────
  GATEWAY_HELLO:     (gwId: string) => `gateway/${gwId}/hello`,
  GATEWAY_HEARTBEAT: (gwId: string) => `gateway/${gwId}/heartbeat`,

  // ── Wildcard subscriptions (server-side) ──────────────────
  ALL_CHECKINS: 'desk/+/checkin',
  ALL_STATUS:   'desk/+/status',
  ALL_QR_SCANS: 'desk/+/qr_scan',
  ALL_GW_HELLO: 'gateway/+/hello',
  ALL_GW_HB:    'gateway/+/heartbeat',
} as const;

// ── Topic parsers ─────────────────────────────────────────────
export function extractDeskId(topic: string): string | null {
  const p = topic.split('/');
  return p.length === 3 && p[0] === 'desk' ? p[1] : null;
}

export function extractGatewayId(topic: string): string | null {
  const p = topic.split('/');
  return p.length === 3 && p[0] === 'gateway' ? p[1] : null;
}

// ── LED hex colors (must match device_config.h) ───────────────
// Spec: free=green, occupied=red, reserved=blue, error=blinking
export const LED_HEX = {
  GREEN:  '#00C800',  // free
  BLUE:   '#0050DC',  // reserved
  RED:    '#DC0000',  // occupied + error + denied
  WHITE:  '#C8C8C8',  // identify flash only
  YELLOW: '#C8A000',  // provisioning / connecting
  OFF:    '#000000',
} as const;

// ── LED state → MQTT command payloads ─────────────────────────
// Per spec: command=set_status, color=#HEX, animation=solid|blink
