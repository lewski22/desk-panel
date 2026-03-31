import { Module }            from '@nestjs/common';
import { JwtModule }         from '@nestjs/jwt';
import { ConfigService }     from '@nestjs/config';
import { OwnerController }   from './owner.controller';
import { OwnerService }      from './owner.service';
import { OwnerHealthService }from './owner-health.service';
import { DatabaseModule }    from '../../database/db.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [OwnerController],
  providers:   [OwnerService, OwnerHealthService],
})
export class OwnerModule {}
