import { Global, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [DocumentsController],
  providers: [StorageService, DocumentsService],
  exports: [StorageService, DocumentsService],
})
export class StorageModule {}
