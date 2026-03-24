export interface Organization { id: string; name: string; slug: string; plan: string; isActive: boolean; createdAt: string; }
export interface Location     { id: string; organizationId: string; name: string; address?: string; city?: string; timezone: string; isActive: boolean; }
export interface Desk         { id: string; locationId: string; name: string; code: string; floor?: string; zone?: string; status: 'ACTIVE'|'INACTIVE'|'MAINTENANCE'; device?: Device | null; }
export interface Device       { id: string; hardwareId: string; mqttUsername: string; firmwareVersion?: string; isOnline: boolean; lastSeen?: string; rssi?: number; deskId?: string; gatewayId?: string; desk?: { name: string; code: string } | null; }
export interface Gateway      { id: string; locationId: string; name: string; isOnline: boolean; lastSeen?: string; ipAddress?: string; version?: string; _count?: { devices: number }; }
export interface User         { id: string; email: string; firstName?: string; lastName?: string; role: 'SUPER_ADMIN'|'OFFICE_ADMIN'|'STAFF'|'END_USER'; isActive: boolean; cardUid?: string; createdAt: string; organizationId?: string; }
export interface Reservation  { id: string; deskId: string; userId: string; date: string; startTime: string; endTime: string; status: string; desk?: { name: string; code: string }; user?: { firstName?: string; lastName?: string; email: string }; }

export interface OccupancyStat { date: string; total: number; occupied: number; pct: number; }
export interface CheckinStat   { method: 'NFC'|'QR'|'MANUAL'; count: number; }
