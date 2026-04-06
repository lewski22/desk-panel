import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export type LedState = 'OCCUPIED' | 'FREE' | 'RESERVED' | 'ERROR';

export interface LedEvent {
  deskId: string;
  state:  LedState;
}

/**
 * SharedService — łączy CheckinsService/ReservationsService z MqttHandlers
 * bez circular dependency.
 *
 * CheckinsService  → ledEvents.emit()  → MqttHandlers subskrybuje → mqtt.publish()
 * ReservationsService → ledEvents.emit() → ...
 *
 * Dependency graph (brak circular):
 *   CheckinsModule  → SharedModule
 *   MqttModule      → SharedModule
 *   ReservationsModule → SharedModule
 */
@Injectable()
export class LedEventsService {
  private readonly subject = new Subject<LedEvent>();

  readonly events$: Observable<LedEvent> = this.subject.asObservable();

  emit(deskId: string, state: LedState): void {
    if (deskId) this.subject.next({ deskId, state });
  }
}
