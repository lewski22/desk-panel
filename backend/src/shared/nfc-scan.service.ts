import { Injectable, Logger } from '@nestjs/common';

interface ScanWaiter {
  resolve:   (cardUid: string) => void;
  reject:    (reason: string)  => void;
  timer:     ReturnType<typeof setTimeout>;
  createdAt: number;
}

/**
 * NfcScanService — rejestruje jednorazowe "sesje oczekiwania" na skan NFC.
 *
 * Flow:
 *   1. Admin wywołuje startSession(userId, timeoutMs)
 *      → zwraca Promise<string> (cardUid) lub rzuca 'timeout'
 *   2. CheckinsService.checkinNfc() wykrywa card_not_registered
 *      → wywołuje notifyScan(cardUid) — jeśli ktoś czeka, otrzymuje UID
 *
 * Przechowuje max 1 sesję per userId. Drugiej wywołanie anuluje poprzednią.
 */
@Injectable()
export class NfcScanService {
  private readonly logger  = new Logger(NfcScanService.name);
  private readonly waiters = new Map<string, ScanWaiter>();

  startSession(userId: string, timeoutMs = 60_000): Promise<string> {
    // Anuluj poprzednią sesję tego samego admina
    this.cancelSession(userId);

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(userId);
        reject('timeout');
      }, timeoutMs);

      this.waiters.set(userId, {
        resolve,
        reject,
        timer,
        createdAt: Date.now(),
      });

      this.logger.debug(`NFC scan session started: userId=${userId} timeout=${timeoutMs}ms`);
    });
  }

  /**
   * Wywoływane gdy beacon zgłosi nieznaną kartę.
   * Jeśli jakakolwiek sesja czeka — przypisuje jej cardUid.
   * Zwraca true jeśli ktoś odebrał skan.
   */
  notifyScan(cardUid: string): boolean {
    if (this.waiters.size === 0) return false;

    // Weź pierwszą czekającą sesję (FIFO)
    const [userId, waiter] = this.waiters.entries().next().value;
    clearTimeout(waiter.timer);
    this.waiters.delete(userId);
    waiter.resolve(cardUid);
    this.logger.log(`NFC scan captured: cardUid=${cardUid} → userId=${userId}`);
    return true;
  }

  hasActiveSession(userId: string): boolean {
    return this.waiters.has(userId);
  }

  cancelSession(userId: string): void {
    const w = this.waiters.get(userId);
    if (w) {
      clearTimeout(w.timer);
      w.reject('cancelled');
      this.waiters.delete(userId);
    }
  }

  /** Cleanup stale sessions (defensive — timer handles it, but useful for tests) */
  getSessionAge(userId: string): number | null {
    const w = this.waiters.get(userId);
    return w ? Date.now() - w.createdAt : null;
  }
}
