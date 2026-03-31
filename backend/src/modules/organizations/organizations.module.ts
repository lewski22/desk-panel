import { Module }                  from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService }    from './organizations.service';
import { AuthModule }              from '../auth/auth.module';
import { DatabaseModule }          from '../../database/db.module';

@Module({
  imports:     [AuthModule, DatabaseModule],
  controllers: [OrganizationsController],
  providers:   [OrganizationsService],
  exports:     [OrganizationsService],
})
export class OrganizationsModule {}
