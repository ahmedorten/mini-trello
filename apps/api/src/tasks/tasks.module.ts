import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentTasksController } from './agent-tasks.controller';
import { AgentTasksService } from './agent-tasks.service';

@Module({
  imports: [AuthModule, CustomersModule, TicketsModule],
  controllers: [AgentTasksController],
  providers: [AgentTasksService],
})
export class TasksModule {}
