import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';
import {
  httpRequestDuration,
  httpRequestsTotal,
  httpErrorsTotal,
} from './metrics.registry';

/**
 * HttpMetricsInterceptor — mierzy każde żądanie HTTP.
 *
 * Rejestruje:
 *   - Czas odpowiedzi (histogram)
 *   - Licznik żądań (counter z status_code)
 *   - Licznik błędów 4xx/5xx
 *
 * Route normalizacja: /users/clxyz123/card → /users/{id}/card
 * Wyklucza: /metrics, /health, /api/docs
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly EXCLUDED = ['/metrics', '/health', '/api/docs'];

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();

    if (this.EXCLUDED.some(p => req.path.startsWith(p))) {
      return next.handle();
    }

    const route  = this._normalizeRoute(req.route?.path ?? req.path);
    const method = req.method;
    const end    = httpRequestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap(() => {
        const status = String(res.statusCode);
        end({ status_code: status });
        httpRequestsTotal.inc({ method, route, status_code: status });
        if (res.statusCode >= 400) {
          httpErrorsTotal.inc({ route, status_code: status });
        }
      }),
      catchError(err => {
        const status = String(err.status ?? 500);
        end({ status_code: status });
        httpRequestsTotal.inc({ method, route, status_code: status });
        httpErrorsTotal.inc({ route, status_code: status });
        return throwError(() => err);
      }),
    );
  }

  /** Zamień dynamiczne segmenty na {param}: /users/abc123 → /users/{id} */
  private _normalizeRoute(path: string): string {
    return path
      .replace(/\/[0-9a-f]{20,}\b/g, '/{id}')   // cuid
      .replace(/\/[0-9a-f-]{36}\b/g, '/{id}')    // uuid
      .replace(/\/\d+\b/g, '/{id}');              // numeric id
  }
}
