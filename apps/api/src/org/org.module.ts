import { Module } from '@nestjs/common';
import { BranchesController, DepartmentsController } from './org.controller';
import { OrgService } from './org.service';

@Module({
  controllers: [DepartmentsController, BranchesController],
  providers: [OrgService],
})
export class OrgModule {}
