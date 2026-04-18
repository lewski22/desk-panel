/**
 * Integration config shapes per provider.
 * Przechowywane jako JSON → encrypted w OrgIntegration.configEncrypted.
 *
 * backend/src/modules/integrations/types/integration-config.types.ts
 */

// ── Azure Entra ID ───────────────────────────────────────────────────────────
export interface AzureEntraConfig {
  tenantId:        string;          // REQUIRED — Azure Tenant ID firmy
  useCustomApp:    boolean;         // false = globalna Reserti App Registration
  clientId?:       string;          // BYOA: własny Client ID (opcjonalne)
  clientSecret?:   string;          // BYOA: własny Client Secret (szyfrowany)
  allowedDomains:  string[];        // ['contoso.com'] — whitelist domen emaili
  groupSync:       boolean;         // sync grup Azure AD → role Reserti (future)
}

// ── Slack ────────────────────────────────────────────────────────────────────
export interface SlackConfig {
  botToken:              string;    // xoxb-xxx (Bot User OAuth Token)
  signingSecret:         string;    // do weryfikacji incoming webhooks
  defaultChannel:        string;    // '#desk-bookings' lub channel ID
  notifyOnReservation:   boolean;
  notifyOnCheckin:       boolean;
  notifyOnBeaconAlert:   boolean;
  notifyOnGatewayAlert:  boolean;
}

// ── Google Workspace ─────────────────────────────────────────────────────────
export interface GoogleWorkspaceConfig {
  clientId:       string;           // z Google Cloud Console (per org)
  clientSecret:   string;           // z Google Cloud Console (per org)
  allowedDomain:  string;           // 'company.com' — hd= param, blokuje inne domeny
}

// ── Microsoft Teams ──────────────────────────────────────────────────────────
export interface MicrosoftTeamsConfig {
  incomingWebhookUrl:    string;    // z Teams → Connectors → Incoming Webhook
  notifyOnReservation:   boolean;
  notifyOnCheckin:       boolean;
  notifyOnBeaconAlert:   boolean;
  notifyOnGatewayAlert:  boolean;
  mentionUserEnabled:    boolean;   // @mention hosta rezerwacji (future: Graph)
}

// ── Custom Webhook ───────────────────────────────────────────────────────────
export type WebhookEvent =
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'reservation.expired'
  | 'checkin.nfc'
  | 'checkin.qr'
  | 'checkin.manual'
  | 'checkout'
  | 'beacon.offline'
  | 'beacon.online'
  | 'gateway.offline'
  | 'gateway.online';

export interface WebhookCustomConfig {
  url:         string;              // https://your-system.com/hook
  secret:      string;              // HMAC-SHA256 signing secret
  events:      WebhookEvent[];      // lista subskrybowanych eventów
  headers?:    Record<string, string>; // dodatkowe nagłówki (np. Authorization)
  timeoutMs:   number;              // domyślnie 5000
  maxRetries:  number;              // domyślnie 3
}

// ── Union type ───────────────────────────────────────────────────────────────
export type AnyIntegrationConfig =
  | AzureEntraConfig
  | SlackConfig
  | GoogleWorkspaceConfig
  | MicrosoftTeamsConfig
  | WebhookCustomConfig;

// ── Public view (bez sekretów) ───────────────────────────────────────────────
// Zwracane do frontendu — credentials zastąpione flagami
export interface IntegrationPublicView {
  id:            string;
  organizationId: string;
  provider:      string;
  isEnabled:     boolean;
  displayName:   string | null;
  tenantHint:    string | null;
  hasConfig:     boolean;          // czy configEncrypted != null
  lastTestedAt:  string | null;
  lastTestOk:    boolean | null;
  lastTestError: string | null;
  // Provider-specific public fields (no secrets)
  publicConfig?: Record<string, unknown>;
}
