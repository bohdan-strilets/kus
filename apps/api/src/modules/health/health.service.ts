import { Injectable, Logger } from '@nestjs/common'
import type { HealthResponse } from '@kus/shared'

import { DatabaseUnavailableException } from './health.exceptions'
import { HealthRepository } from './health.repository'

/** Railway's healthcheck: a deploy with a wrong DATABASE_URL must not go live as healthy. */
@Injectable()
export class HealthService {
	private readonly logger = new Logger(HealthService.name)

	constructor(private readonly healthRepository: HealthRepository) {}

	async getStatus(): Promise<HealthResponse> {
		try {
			await this.healthRepository.ping()
		} catch (error) {
			// the driver error may quote the connection target: only its class goes to the log
			this.logger.error(`Database ping failed (${error instanceof Error ? error.name : 'unknown'})`)
			throw new DatabaseUnavailableException()
		}
		return { status: 'ok' }
	}
}
