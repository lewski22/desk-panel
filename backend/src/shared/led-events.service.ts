/**
 * LedEventsService — wewnętrzny event bus dla stanu LED biurek.
 *
 * Emituje zdarzenia zmiany stanu (FREE / OCCUPIED / RESERVED / ERROR /
 * GUEST_RESERVED) z domeny rezerwacji i check-inów do GatewaysService,
 * który przekazuje je do beaconów przez MQTT. Używa RxJS Subject, dzięki
 * czemu nadawca i odbiorca są luźno powiązane — każdy może subskrybować
 * strumień events$ niezależnie.
 *
 * backend/src/shared/led-events.service.ts
 */
import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export type LedState = 'OCCUPIED' | 'FREE' | 'RESERVED' | 'ERROR' | 'GUEST_RESERVED';

export interface LedEvent {
  deskId: string;
  state:  LedState;
}

@Injectable()
export class LedEventsService {
  private readonly subject = new Subject<LedEvent>();

  /** Strumień zdarzeń LED — subskrybuj w GatewaysService. */
  readonly events$: Observable<LedEvent> = this.subject.asObservable();

  /** Emituje zmianę stanu LED dla biurka. Ignoruje puste deskId. */
  emit(deskId: string, state: LedState): void {
    if (deskId) this.subject.next({ deskId, state });
  }
}
