import { Inject, Injectable, Logger } from '@nestjs/common'

import { StorageUnavailableException } from './storage.exceptions'
import { STORAGE_ADAPTER } from './storage.constants'
import type { PutObjectInput, StorageAdapter, StoredObject } from './storage.types'

/** Object storage for user photos. A backend failure becomes STORAGE_UNAVAILABLE; a missing object is `null`. */
@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name)

	constructor(@Inject(STORAGE_ADAPTER) private readonly adapter: StorageAdapter) {}

	putObject = (input: PutObjectInput): Promise<void> =>
		this.run('put', () => this.adapter.putObject(input))

	getObject = (key: string): Promise<StoredObject | null> =>
		this.run('get', () => this.adapter.getObject(key))

	deleteObject = (key: string): Promise<void> =>
		this.run('delete', () => this.adapter.deleteObject(key))

	deleteByPrefix = (prefix: string): Promise<void> =>
		this.run('deleteByPrefix', () => this.adapter.deleteByPrefix(prefix))

	/** The SDK error may quote the endpoint, bucket or key: only the operation and error class are logged. */
	private async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
		try {
			return await action()
		} catch (error) {
			this.logger.error(
				`Storage ${operation} failed (${error instanceof Error ? error.name : 'unknown'})`,
			)
			throw new StorageUnavailableException()
		}
	}
}
