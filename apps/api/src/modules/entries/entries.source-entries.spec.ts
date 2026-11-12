import { describe, expect, it, vi } from 'vitest'

import { EntriesRepository } from './entries.repository'
import { EntriesService } from './entries.service'

const createService = (rows: unknown[]) => {
	const findSourceEntries = vi.fn().mockResolvedValue(rows)
	const service = new EntriesService({ findSourceEntries } as unknown as EntriesRepository)
	return { service, findSourceEntries }
}

describe('EntriesService.findSourceEntries', () => {
	it('tells which entries the messages logged and which of them are deleted', async () => {
		const { service, findSourceEntries } = createService([
			{ id: 'a', sourceMessageId: 'm1', deletedAt: null },
			{ id: 'b', sourceMessageId: 'm1', deletedAt: new Date('2026-11-11T21:00:00Z') },
		])

		const entries = await service.findSourceEntries('u1', ['m1'])

		expect(findSourceEntries).toHaveBeenCalledWith({ userId: 'u1', messageIds: ['m1'] })
		expect(entries).toEqual([
			{ id: 'a', sourceMessageId: 'm1', isDeleted: false },
			{ id: 'b', sourceMessageId: 'm1', isDeleted: true },
		])
	})

	it('asks nothing for no messages', async () => {
		const { service, findSourceEntries } = createService([])

		expect(await service.findSourceEntries('u1', [])).toEqual([])
		expect(findSourceEntries).not.toHaveBeenCalled()
	})
})
