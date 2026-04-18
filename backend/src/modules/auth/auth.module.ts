/**
 * PATCH: backend/src/modules/auth/auth.module.ts
 *
 * Dodaje GoogleAuthService do modułu Auth.
 * IntegrationsModule jest @Global() — GoogleProvider i IntegrationsService
 * dostępne automatycznie przez DI (nie musisz ich dodawać do imports[]).
 */
import { Module }           from '@nestjs/common';
import { JwtModule }        from '@nestjs/jwt';
import { PassportModule }   from '@nestjs/passport';
import { ConfigService }    from '@nestjs/config';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { AzureAuthService } from './azure-auth.service';
import { GoogleAuthService } from './google-auth.service';   // ← NOWY
import { JwtStrategy }      from './strategies/jwt.strategy';
import { LocalStrategy }    from './strategies/local.strategy';
import { UsersModule }      from '../users/users.module';
import { DatabaseModule }   from '../../database/db.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    // IntegrationsModule jest @Global() — nie trzeba importować
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AzureAuthService,
    GoogleAuthService,    // ← DODAJ
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [
    AuthService,
    AzureAuthService,
    GoogleAuthService,    // ← DODAJ (jeśli inne moduły potrzebują)
  ],
})
export class AuthModule {}
