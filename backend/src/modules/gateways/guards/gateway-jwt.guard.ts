import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request }       from 'express';

/**
 * Weryfikuje JWT wydany przez GatewayAuthService.
 * Używa JWT_GATEWAY_SECRET — oddzielnego od tokenów użytkowników (JWT_SECRET).
 * Wymaga scope: 'gateway' w payload — odrzuca tokeny użytkowników.
 */
@Injectable()
export class GatewayJwtGuard implements CanActivate {
  constructor(
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req: Request = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_GATEWAY_SECRET'),
      }) as { sub: string; scope: string };

      if (payload.scope !== 'gateway') {
        throw new UnauthorizedException('invalid token scope');
      }

      (req as any).gatewayId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('invalid or expired gateway token');
    }
  }
}
