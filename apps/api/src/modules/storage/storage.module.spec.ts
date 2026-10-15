import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import type { Env } from '../../config'
import { MemoryStorageAdapter } from './memory.adapter'
import { S3StorageAdapter } from './s3.adapter'
import { createStorageAdapter } from './storage.module'

const S3_VALUES: Record<string, string> = {
	S3_ENDPOINT: 'https://s3.example.com',
	S3_REGION: 'auto',
	S3_ACCESS_KEY_ID: 'access',
	S3_SECRET_ACCESS_KEY: 'secret',
	S3_BUCKET: 'bucket',
}

const createConfig = (provider: 'memory' | 's3'): ConfigService<Env, true> =>
	({
		get: (name: string) => (name === 'STORAGE_PROVIDER' ? provider : S3_VALUES[name]),
	}) as unknown as ConfigService<Env, true>

describe('createStorageAdapter', () => {
	it('returns the in-memory adapter for the memory provider', () => {
		expect(createStorageAdapter(createConfig('memory'))).toBeInstanceOf(MemoryStorageAdapter)
	})

	it('builds the S3 adapter for the s3 provider', () => {
		expect(createStorageAdapter(createConfig('s3'))).toBeInstanceOf(S3StorageAdapter)
	})
})
