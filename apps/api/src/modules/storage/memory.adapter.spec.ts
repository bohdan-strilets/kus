import { beforeEach, describe, expect, it } from 'vitest'

import { MemoryStorageAdapter } from './memory.adapter'
import { buildStorageKey, buildUserPrefix } from './storage-key'

const CONTENT_TYPE = 'image/jpeg'

const keyFor = (userId: string, fileId: string): string =>
	buildStorageKey({ prefix: 'dev', userId, kind: 'photos', fileId })

describe('MemoryStorageAdapter', () => {
	let adapter: MemoryStorageAdapter

	beforeEach(() => {
		adapter = new MemoryStorageAdapter()
	})

	it('returns what was put', async () => {
		await adapter.putObject({ key: 'k', body: Buffer.from([1, 2, 3]), contentType: CONTENT_TYPE })

		const stored = await adapter.getObject('k')

		expect(stored?.body.equals(Buffer.from([1, 2, 3]))).toBe(true)
		expect(stored?.contentType).toBe(CONTENT_TYPE)
	})

	it('returns null for a missing key', async () => {
		expect(await adapter.getObject('missing')).toBeNull()
	})

	it('deletes a single object and ignores a missing one', async () => {
		await adapter.putObject({ key: 'k', body: Buffer.from('a'), contentType: CONTENT_TYPE })

		await adapter.deleteObject('k')
		await expect(adapter.deleteObject('k')).resolves.toBeUndefined()

		expect(await adapter.getObject('k')).toBeNull()
	})

	it('deleteByPrefix removes only that user, not another user or a look-alike prefix', async () => {
		const mine = keyFor('u1', 'a')
		const mineThumb = buildStorageKey({
			prefix: 'dev',
			userId: 'u1',
			kind: 'photos',
			fileId: 'a',
			variant: 'thumb',
		})
		const lookAlike = keyFor('u10', 'a')
		const other = keyFor('u2', 'a')
		for (const key of [mine, mineThumb, lookAlike, other]) {
			await adapter.putObject({ key, body: Buffer.from('x'), contentType: CONTENT_TYPE })
		}

		await adapter.deleteByPrefix(buildUserPrefix({ prefix: 'dev', userId: 'u1' }))

		expect(await adapter.getObject(mine)).toBeNull()
		expect(await adapter.getObject(mineThumb)).toBeNull()
		expect(await adapter.getObject(lookAlike)).not.toBeNull()
		expect(await adapter.getObject(other)).not.toBeNull()
	})

	it('isolates stored data from the caller buffer', async () => {
		const input = Buffer.from([1, 2, 3])
		await adapter.putObject({ key: 'k', body: input, contentType: CONTENT_TYPE })
		input[0] = 9

		const first = await adapter.getObject('k')
		first?.body.fill(7)
		const second = await adapter.getObject('k')

		expect(second?.body.equals(Buffer.from([1, 2, 3]))).toBe(true)
	})
})
