/**
 * backend/src/shared/storage.module.ts
 *
 * Globalny moduł — importuj raz w AppModule:
 *   StorageModule.forRoot()
 */
import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService],
  exports:   [StorageService],
})
export class StorageModule {}
