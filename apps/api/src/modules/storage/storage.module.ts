import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config'
import { MemoryStorageAdapter } from './memory.adapter'
import { S3StorageAdapter } from './s3.adapter'
import { STORAGE_ADAPTER } from './storage.constants'
import { StorageService } from './storage.service'
import type { StorageAdapter } from './storage.types'

export const createStorageAdapter = (config: ConfigService<Env, true>): StorageAdapter => {
	const provider = config.get('STORAGE_PROVIDER', { infer: true })
	if (provider === 'memory') return new MemoryStorageAdapter()
	// env validation guarantees the S3 variables when the provider is 's3'
	return new S3StorageAdapter({
		endpoint: config.get('S3_ENDPOINT', { infer: true }),
		region: config.get('S3_REGION', { infer: true }),
		accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
		secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
		bucket: config.get('S3_BUCKET', { infer: true }),
	})
}

@Global()
@Module({
	providers: [
		{ provide: STORAGE_ADAPTER, inject: [ConfigService], useFactory: createStorageAdapter },
		StorageService,
	],
	exports: [StorageService],
})
export class StorageModule {}
