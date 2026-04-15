// Metadane typów powiadomień — używane przez frontend do wyświetlania listy
// i przez serwis do budowania odpowiednich treści emaili.

export const NOTIFICATION_META: Record<string, {
  label:       string;
  description: string;
  category:    'system' | 'infrastruktura' | 'rezerwacje';
  defaultEnabled: boolean;
  // Czy wymaga thresholdMin (np. "offline po X minutach")
  hasThreshold: boolean;
}> = {
  FIRMWARE_UPDATE_AVAILABLE: {
    label:          'Nowa wersja firmware',
    description:    'Powiadomienie gdy na GitHub pojawi się nowsza wersja firmware dla beaconów',
    category:       'system',
    defaultEnabled: true,
    hasThreshold:   false,
  },
  GATEWAY_OFFLINE: {
    label:          'Gateway stracił połączenie',
    description:    'Alert gdy gateway (Raspberry Pi) nie wysyła heartbeatu przez zadany czas',
    category:       'infrastruktura',
    defaultEnabled: true,
    hasThreshold:   true,  // thresholdMin: ile minut ciszy = alert
  },
  BEACON_OFFLINE: {
    label:          'Beacon stracił połączenie',
    description:    'Alert gdy beacon przy biurku nie wysyła heartbeatu przez zadany czas',
    category:       'infrastruktura',
    defaultEnabled: true,
    hasThreshold:   true,
  },
  RESERVATION_CONFIRMED: {
    label:          'Potwierdzenie rezerwacji',
    description:    'Email do pracownika po wykonaniu rezerwacji biurka',
    category:       'rezerwacje',
    defaultEnabled: false,
    hasThreshold:   false,
  },
  RESERVATION_REMINDER: {
    label:          'Przypomnienie o rezerwacji',
    description:    'Email 30 minut przed zaplanowaną rezerwacją',
    category:       'rezerwacje',
    defaultEnabled: false,
    hasThreshold:   false,
  },
  RESERVATION_CANCELLED: {
    label:          'Anulowanie rezerwacji',
    description:    'Email do pracownika gdy rezerwacja zostanie anulowana',
    category:       'rezerwacje',
    defaultEnabled: false,
    hasThreshold:   false,
  },
  CHECKIN_MISSED: {
    label:          'Brak check-in (auto-release)',
    description:    'Email do pracownika gdy biurko zostało zwolnione z powodu braku check-in',
    category:       'rezerwacje',
    defaultEnabled: false,
    hasThreshold:   false,
  },
  DAILY_REPORT: {
    label:          'Dzienny raport zajętości',
    description:    'Raport wysyłany codziennie rano z podsumowaniem zajętości biurek z poprzedniego dnia',
    category:       'system',
    defaultEnabled: false,
    hasThreshold:   false,
  },
};

export type NotificationCategory = 'system' | 'infrastruktura' | 'rezerwacje';
