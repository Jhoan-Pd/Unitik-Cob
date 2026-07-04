import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthReport, HealthService } from './health.service';

/**
 * Service continuity policy (ISO/IEC 38500 — Strategy + Performance):
 * exposes the aggregated health of every critical dependency so operators
 * in Cumbitara can diagnose connectivity issues quickly.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de salud del sistema y sus dependencias' })
  async check(): Promise<HealthReport> {
    return this.healthService.check();
  }
}
