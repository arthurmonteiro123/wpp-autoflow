import { Module } from '@nestjs/common';
import { EvolutionModule } from '../evolution/evolution.module';
import { InstanceMappingModule } from '../instance-mapping/instance-mapping.module';
import { OperatingHoursService } from '../../common/services/operating-hours.service';
import { AIRepository } from './ai.repository';
import { AIService } from './ai.service';

@Module({
  imports: [EvolutionModule, InstanceMappingModule],
  providers: [OperatingHoursService, AIRepository, AIService],
})
export class AIModule {}
