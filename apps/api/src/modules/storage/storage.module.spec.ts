import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import type { Env } from '../../config'
import { MemoryStorageAdapter } from './memory.adapter'
import { createStorageAdapter } from './storage.module'

const createConfig = (provider: 'memory' | 'r2'): ConfigService<Env, true> =>
	({ get: () => provider }) as unknown as ConfigService<Env, true>

describe('createStorageAdapter', () => {
	it('returns the in-memory adapter for the memory provider', () => {
		expect(createStorageAdapter(createConfig('memory'))).toBeInstanceOf(MemoryStorageAdapter)
	})

	it('throws for r2 until its adapter exists', () => {
		expect(() => createStorageAdapter(createConfig('r2'))).toThrow()
	})
})
