import { Controller, Get } from '@nestjs/common'
import type { HealthResponse } from '@kus/shared'

import { Public } from '../../common/decorators'
import { HealthService } from './health.service'

@Public()
@Controller('health')
export class HealthController {
	constructor(private readonly healthService: HealthService) {}

	@Get()
	getHealth(): Promise<HealthResponse> {
		return this.healthService.getStatus()
	}
}
