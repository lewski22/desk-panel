import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config:  ConfigService,
    private prisma:  PrismaService,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // FIX: verify user is still active on every request
    // Prevents deactivated / soft-deleted users from using stale tokens
    const user = await this.prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true, deletedAt: true, organizationId: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Konto jest nieaktywne');
    }
    return {
      id:             user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organizationId,
    };
  }
}
