export const TOPICS = {
  DESK_CHECKIN:   (d: string) => `desk/${d}/checkin`,
  DESK_STATUS:    (d: string) => `desk/${d}/status`,
  DESK_COMMAND:   (d: string) => `desk/${d}/command`,
  GW_HELLO:       (g: string) => `gateway/${g}/hello`,
  GW_HEARTBEAT:   (g: string) => `gateway/${g}/heartbeat`,
};
export const LED_PAYLOADS: Record<string, any> = {
  OCCUPIED: { command: 'SET_LED', params: { color: '#DC0000', animation: 'solid' } },
  FREE:     { command: 'SET_LED', params: { color: '#00C800', animation: 'solid' } },
  RESERVED: { command: 'SET_LED', params: { color: '#0050DC', animation: 'solid' } },
  ERROR:          { command: 'SET_LED', params: { color: '#DC0000', animation: 'blink' } },
  GUEST_RESERVED: { command: 'SET_LED', params: { color: '#C8A000', animation: 'solid' } },
};
