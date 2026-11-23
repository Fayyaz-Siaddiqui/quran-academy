import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { TenantService } from './tenant.service';

@Global()
@Module({
  providers: [AccessService, TenantService],
  exports: [AccessService, TenantService],
})
export class AccessModule {}
