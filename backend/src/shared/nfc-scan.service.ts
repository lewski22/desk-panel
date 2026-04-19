import { Injectable, Logger } from '@nestjs/common';

interface ScanWaiter {
  resolve:   (cardUid: string) => void;
  reject:    (reason: string)  => void;
  timer:     ReturnType<typeof setTimeout>;
  createdAt: number;
}

/**
 * NfcScanService — rejestruje jednorazowe sesje oczekiwania na skan NFC.
 * Admin wywołuje startSession() → następny nieznany skan trafia do sesji.
 */
@Injectable()
export class NfcScanService {
  private readonly logger  = new Logger(NfcScanService.name);
  private readonly waiters = new Map<string, ScanWaiter>();

  startSession(userId: string, timeoutMs = 60_000): Promise<string> {
    this.cancelSession(userId);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(userId);
        reject('timeout');
      }, timeoutMs);
      this.waiters.set(userId, { resolve, reject, timer, createdAt: Date.now() });
      this.logger.debug(`NFC scan session started: userId=${userId} timeout=${timeoutMs}ms`);
    });
  }

  notifyScan(cardUid: string): boolean {
    if (this.waiters.size === 0) return false;
    const [userId, waiter] = this.waiters.entries().next().value as [string, ScanWaiter];
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
    if (w) { clearTimeout(w.timer); w.reject('cancelled'); this.waiters.delete(userId); }
  }

  getSessionAge(userId: string): number | null {
    const w = this.waiters.get(userId);
    return w ? Date.now() - w.createdAt : null;
  }
}
