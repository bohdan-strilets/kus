import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'

import type { Env } from '../../config'
import {
	CLEANUP_BATCH_SIZE,
	CLEANUP_CRON,
	CLEANUP_MAX_CONSECUTIVE_FAILURES,
} from './photos.constants'
import { PhotosRepository } from './photos.repository'
import { PhotosService, REMOVE_DONE } from './photos.service'

export interface CleanupResult {
	removed: number
	skipped: number
}

const MS_PER_HOUR = 3_600_000

/**
 * Deletes uploads no message ever used (uploaded, then the send never happened) after
 * PHOTO_ORPHAN_TTL_HOURS. Each file goes through the same guarded removal as DELETE /photos/:id.
 * A failed file stays and is retried by the next run. Logs counts and ids only.
 */
@Injectable()
export class PhotosCleanupService {
	private readonly logger = new Logger(PhotosCleanupService.name)
	private readonly orphanTtlMs: number

	constructor(
		private readonly photosRepository: PhotosRepository,
		private readonly photosService: PhotosService,
		config: ConfigService<Env, true>,
	) {
		this.orphanTtlMs = config.get('PHOTO_ORPHAN_TTL_HOURS', { infer: true }) * MS_PER_HOUR
	}

	@Cron(CLEANUP_CRON)
	async cleanupOnSchedule(): Promise<void> {
		try {
			await this.cleanupOrphans(new Date())
		} catch (error) {
			// the scheduler would swallow it; the next run retries, nothing is lost
			this.logger.error(
				`Orphan photo cleanup failed (${error instanceof Error ? error.name : 'unknown'})`,
			)
		}
	}

	async cleanupOrphans(now: Date): Promise<CleanupResult> {
		const olderThan = new Date(now.getTime() - this.orphanTtlMs)
		const result: CleanupResult = { removed: 0, skipped: 0 }
		let consecutiveFailures = 0
		let afterId: string | undefined

		for (;;) {
			const orphans = await this.photosRepository.findOrphans({
				olderThan,
				limit: CLEANUP_BATCH_SIZE,
				afterId,
			})
			if (orphans.length === 0) break

			for (const { id, userId } of orphans) {
				try {
					// a lost race (bound or deleted meanwhile) is normal, not a failure
					if ((await this.photosService.removeUnattached(userId, id)) === REMOVE_DONE) {
						result.removed += 1
					}
					consecutiveFailures = 0
				} catch (error) {
					result.skipped += 1
					consecutiveFailures += 1
					this.logger.warn(
						`Orphan photo cleanup skipped user=${userId} file=${id} (${error instanceof Error ? error.name : 'unknown'})`,
					)
					if (consecutiveFailures >= CLEANUP_MAX_CONSECUTIVE_FAILURES) {
						this.logger.warn(
							`Orphan photo cleanup stopped after ${consecutiveFailures} failures in a row (rest next run)`,
						)
						return this.finish(result)
					}
				}
			}
			// failed files stay orphans, so the cursor (not a re-query) moves the loop forward
			afterId = orphans[orphans.length - 1]?.id
		}
		return this.finish(result)
	}

	private finish(result: CleanupResult): CleanupResult {
		if (result.removed > 0 || result.skipped > 0) {
			this.logger.log(
				`Orphan photo cleanup done: removed ${result.removed}, skipped ${result.skipped}`,
			)
		}
		return result
	}
}
