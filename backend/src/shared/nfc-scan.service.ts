import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { take, timeout, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
@Injectable()
export class NfcScanService {
  private readonly scans$ = new Subject<string>();
  notifyScan(uid: string): void { this.scans$.next(uid); }
  waitForScan(ms = 30000): Observable<string> {
    return this.scans$.pipe(take(1), timeout(ms), catchError(() => EMPTY));
  }
}
