import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from '@kus/shared'

import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
	constructor(private readonly healthService: HealthService) {}

	@Get()
	getHealth(): HealthResponse {
		return this.healthService.getStatus()
	}
}
