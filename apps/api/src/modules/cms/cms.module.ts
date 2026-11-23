import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { LeadsController } from './leads.controller';

@Module({ controllers: [CmsController, LeadsController] })
export class CmsModule {}
