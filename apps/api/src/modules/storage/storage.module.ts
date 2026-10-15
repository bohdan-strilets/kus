import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config'
import { MemoryStorageAdapter } from './memory.adapter'
import { STORAGE_ADAPTER } from './storage.constants'
import { StorageService } from './storage.service'
import type { StorageAdapter } from './storage.types'

export const createStorageAdapter = (config: ConfigService<Env, true>): StorageAdapter => {
	const provider = config.get('STORAGE_PROVIDER', { infer: true })
	if (provider === 'memory') return new MemoryStorageAdapter()
	// the R2 adapter arrives in the next step; env validation already guarantees its variables
	throw new Error('R2 adapter not implemented yet')
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
