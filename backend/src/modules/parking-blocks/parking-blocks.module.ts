import { Module }                  from '@nestjs/common';
import { PrismaService }           from '../../database/prisma.service';
import { ParkingBlocksService }    from './parking-blocks.service';
import { ParkingBlocksController } from './parking-blocks.controller';

@Module({
  providers:   [ParkingBlocksService, PrismaService],
  controllers: [ParkingBlocksController],
  exports:     [ParkingBlocksService],
})
export class ParkingBlocksModule {}
