/**
 * JwtStrategy — weryfikacja JWT i ładowanie profilu użytkownika do request.
 *
 * Ekstrahuje token z ciasteczka httpOnly access_token (priorytet) lub
 * nagłówka Authorization: Bearer. Po weryfikacji podpisu ładuje aktualny
 * stan konta z bazy — rzuca 401 jeśli konto jest nieaktywne lub usunięte.
 * Wynik validate() trafia do request.user i jest dostępny w każdym kontrolerze.
 *
 * backend/src/modules/auth/strategies/jwt.strategy.ts
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtPayload } from '../types/jwt-payload.interface';

function extractJwtFromCookieOrBearer(req: Request): string | null {
  if (req?.cookies?.access_token) return req.cookies.access_token;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService, private prisma: PrismaService) {
    super({ jwtFromRequest: extractJwtFromCookieOrBearer, ignoreExpiration: false, secretOrKey: config.get('JWT_SECRET'), passReqToCallback: false });
  }
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, isActive: true, deletedAt: true, organizationId: true } });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException('Konto jest nieaktywne');
    return { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
  }
}
