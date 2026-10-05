import { Injectable } from '@nestjs/common'
import type { HealthResponse } from '@kus/shared'

@Injectable()
export class HealthService {
	getStatus(): HealthResponse {
		return { status: 'ok' }
	}
}
