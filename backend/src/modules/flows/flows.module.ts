import { Module } from '@nestjs/common';
import { FlowsRepository } from './flows.repository';
import { FlowsService } from './flows.service';
import { FlowsController } from './flows.controller';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [EvolutionModule],
  controllers: [FlowsController],
  providers: [FlowsRepository, FlowsService],
  exports: [FlowsService],
})
export class FlowsModule {}
