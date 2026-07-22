import { Module } from '@nestjs/common';
import { EvolutionModule } from '../evolution/evolution.module';
import { InstanceMappingRepository } from './instance-mapping.repository';
import { InstanceMappingService } from './instance-mapping.service';
import { InstanceMappingController } from './instance-mapping.controller';

@Module({
  imports: [EvolutionModule],
  controllers: [InstanceMappingController],
  providers: [InstanceMappingRepository, InstanceMappingService],
  exports: [InstanceMappingService],
})
export class InstanceMappingModule {}
