import { Module }             from '@nestjs/common';
import { VisitorsService }    from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { PrismaService }      from '../../database/prisma.service';

@Module({
  controllers: [VisitorsController],
  providers:   [VisitorsService, PrismaService],
  exports:     [VisitorsService],
})
export class VisitorsModule {}
