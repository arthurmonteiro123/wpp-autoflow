import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { InstanceMappingService } from './instance-mapping.service';
import { UpsertMappingDto } from './dto/upsert-mapping.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Instance Mapping')
@ApiBearerAuth('access-token')
@Controller('instance-mapping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InstanceMappingController {
  constructor(private service: InstanceMappingService) {}

  @Get()
  @ApiOperation({ summary: 'List all instance-to-star mappings' })
  findAll() {
    return this.service.findAll();
  }

  @Put()
  @ApiOperation({ summary: 'Create or update an instance-to-star mapping' })
  upsert(@Body() dto: UpsertMappingDto) {
    return this.service.upsert(dto);
  }

  @Patch(':role/active')
  @ApiOperation({ summary: 'Enable or disable a mapping by instance role' })
  @ApiBody({ schema: { properties: { active: { type: 'boolean' } } } })
  setActive(@Param('role') role: string, @Body('active') active: boolean) {
    return this.service.setActive(role, active);
  }
}
