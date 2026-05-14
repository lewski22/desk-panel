// Manual API type interfaces (replaces `as any` in client.ts)

export interface Desk {
  id:           string;
  name:         string;
  code:         string;
  locationId:   string;
  floor?:       string | null;
  zone?:        string | null;
  isActive:     boolean;
  isOccupied?:  boolean;
  hardwareId?:  string | null;
  qrToken?:     string;
  currentReservation?: {
    id:        string;
    userId:    string;
    startTime: string;
    endTime:   string;
    qrToken:   string;
    user?:     { firstName: string; lastName: string };
  } | null;
  checkins?: Array<{ id: string; userId: string; checkedInAt: string }>;
  posX?: number | null;
  posY?: number | null;
}

export interface Reservation {
  id:         string;
  deskId:     string;
  userId:     string;
  date:       string;
  startTime:  string;
  endTime:    string;
  status:     string;
  qrToken:    string;
  desk?:      { name: string; code: string };
  user?:      { firstName: string; lastName: string; email: string };
}

export interface User {
  id:             string;
  email:          string;
  firstName:      string;
  lastName:       string;
  role:           string;
  organizationId: string;
  cardUid?:       string | null;
  isActive:       boolean;
}

export interface Gateway {
  id:         string;
  name:       string;
  locationId: string;
  isOnline:   boolean;
  ipAddress?: string | null;
  version?:   string | null;
  lastSeen?:  string | null;
}

export interface Device {
  id:           string;
  hardwareId:   string;
  gatewayId?:   string | null;
  deskId?:      string | null;
  isOnline:     boolean;
  rssi?:        number | null;
  firmwareVersion?: string | null;
  lastSeen?:    string | null;
}

export interface Location {
  id:                string;
  name:              string;
  address?:          string | null;
  organizationId:    string;
  ledColorFree?:     string | null;
  ledColorOccupied?: string | null;
  ledColorReserved?: string | null;
  ledBrightness?:    number | null;
  floorPlanUrl?:     string | null;
}

export interface ApiError {
  message:    string;
  statusCode: number;
  error?:     string;
}

// ─── Reports ──────────────────────────────────────────────────

export interface SnapshotRow {
  locationId:        string;
  locationName:      string;
  totalDesks:        number;
  occupiedNow:       number;
  occupancyPct:      number;
  checkinsToday:     number;
  reservationsToday: number;
  zones: Array<{
    zone:     string;
    total:    number;
    occupied: number;
  }>;
}

export interface ReservationsByDayRow {
  date:      string;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export interface ReservationsByMethodRow {
  method: string;
  count:  number;
}

export interface ReservationsByUserRow {
  userId:    string;
  email:     string;
  firstName: string | null;
  lastName:  string | null;
  count:     number;
}

export interface ReservationsByDeskRow {
  deskId:       string;
  name:         string;
  locationName: string;
  count:        number;
}

export interface UtilizationRow {
  deskId:         string;
  deskName:       string;
  deskCode:       string;
  floor:          string | null;
  zone:           string | null;
  locationId:     string;
  locationName:   string;
  reservations:   number;
  workdays:       number;
  utilizationPct: number;
}

export interface HeatmapCell {
  hour:  number;
  day:   number;
  value: number;
}

// ─── Analytics / Dashboard Extended ──────────────────────────

export interface DashboardSnapshot {
  totalDesks:        number;
  occupiedNow:       number;
  reservationsToday: number;
  checkinsToday:     number;
  occupancyPct:      number;
}

export interface ExtendedStats {
  weekTrend:     number;
  lastWeekCount: number;
  topDesks: Array<{
    id:     string;
    name:   string;
    _count: { checkins: number };
  }>;
  weekData: Array<{
    day:      string;
    checkins: number;
  }>;
  hourly: Array<{
    hour:  string;
    count: number;
  }>;
}

// ─── Resources (sale, parking, sprzęt) ───────────────────────

export interface Resource {
  id:               string;
  locationId:       string;
  type:             'ROOM' | 'PARKING' | 'EQUIPMENT';
  name:             string;
  code:             string;
  description?:     string | null;
  capacity?:        number | null;
  amenities:        string[];
  vehicleType?:     string | null;
  floor?:           string | null;
  zone?:            string | null;
  notes?:           string | null;
  status:           string;
  posX?:            number | null;
  posY?:            number | null;
  isAvailable?:     boolean;
  qrToken?:         string | null;
  accessMode?:      'PUBLIC' | 'GROUP_RESTRICTED';
  groups?:          { id: string; name: string }[];
  location?: {
    name:                    string;
    timezone:                string;
    parkingQrCheckinEnabled?: boolean;
  };
}

export interface Booking {
  id:         string;
  resourceId: string;
  userId:     string;
  date:       string;
  startTime:  string;
  endTime:    string;
  status:     string;
  notes?:     string | null;
  resource?:  { name: string; code: string; type: string };
  user?:      { firstName: string; lastName: string; email: string };
}

// ─── Visitors ────────────────────────────────────────────────

export interface Visitor {
  id:           string;
  locationId:   string;
  hostUserId:   string;
  firstName:    string;
  lastName?:    string | null;
  email?:       string | null;
  company?:     string | null;
  visitDate:    string;
  purpose?:     string | null;
  status:       'INVITED' | 'CHECKED_IN' | 'CHECKED_OUT';
  qrToken:      string;
  checkedInAt?:  string | null;
  checkedOutAt?: string | null;
  host?: {
    firstName: string;
    lastName:  string;
    email:     string;
  };
}

// ─── Organization ─────────────────────────────────────────────

export interface Organization {
  id:                  string;
  name:                string;
  slug:                string;
  plan:                string;
  isActive:            boolean;
  limitDesks?:         number | null;
  limitUsers?:         number | null;
  limitGateways?:      number | null;
  limitLocations?:     number | null;
  planExpiresAt?:      string | null;
  enabledModules?:     string[];
  passwordExpiryDays?: number | null;
}

// ─── Pagination ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:  T[];
  meta: {
    total:   number;
    page:    number;
    perPage: number;
    pages:   number;
  };
}

// ─── Notification ─────────────────────────────────────────────

export interface InAppNotification {
  id:           string;
  userId:       string;
  type:         string;
  title:        string;
  body:         string;
  read:         boolean;
  readAt?:      string | null;
  actionUrl?:   string | null;
  actionLabel?: string | null;
  meta?:        string | null;
}
