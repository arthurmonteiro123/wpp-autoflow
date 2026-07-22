import { Injectable } from '@nestjs/common';
import { EvolutionService, InstanceRole } from '../evolution/evolution.service';
import { InstanceMappingRepository } from './instance-mapping.repository';
import { UpsertMappingDto } from './dto/upsert-mapping.dto';

@Injectable()
export class InstanceMappingService {
  constructor(
    private repo: InstanceMappingRepository,
    private evolutionService: EvolutionService,
  ) {}

  findAll() {
    return this.repo.findAll();
  }

  upsert(dto: UpsertMappingDto) {
    return this.repo.upsert(dto.instanceRole, dto.starRatings);
  }

  setActive(instanceRole: string, active: boolean) {
    return this.repo.setActive(instanceRole, active);
  }

  // Returns the Evolution API instance name that handles a given star rating.
  // When multiple instances are mapped to the same rating, picks the first active one.
  // Falls back to shelby if nothing is configured.
  async resolveInstanceForStarRating(starRating: string): Promise<string> {
    const mappings = await this.repo.findActiveForStarRating(starRating);

    if (mappings.length === 0) return this.evolutionService.shelbyInstance;

    const role = mappings[0].instanceRole as InstanceRole;
    return this.evolutionService.getInstanceName(role);
  }
}
