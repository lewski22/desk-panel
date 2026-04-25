// ── desks.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';
import { DesksController } from './desks.controller';
import { DesksService } from './desks.service';
import { SharedModule } from '../../shared/shared.module'; // FIX P2-4: provides LedEventsService

@Module({
  imports: [SharedModule],
  controllers: [DesksController],
  providers: [DesksService],
  exports: [DesksService],
})
export class DesksModule {}
