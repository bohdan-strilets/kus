import { describe, expect, it, vi } from 'vitest'

import { ChatRepository, DAY_HISTORY_QUERY_CAP } from './chat.repository'

const createRepository = (rows: { id: string }[]) => {
	const findMany = vi.fn().mockResolvedValue(rows)
	const repository = new ChatRepository({ message: { findMany } } as never)
	return { repository, findMany }
}

describe('ChatRepository.findDayHistory', () => {
	const since = new Date('2026-11-11T19:00:00Z')

	it('takes the newest messages of the day, so on overflow the oldest are lost', async () => {
		const { repository, findMany } = createRepository([])

		await repository.findDayHistory({ userId: 'u1', beforeId: 'm9', since })

		expect(findMany.mock.calls[0]?.[0]).toMatchObject({
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: DAY_HISTORY_QUERY_CAP,
		})
		expect(DAY_HISTORY_QUERY_CAP).toBe(200)
	})

	it('returns the messages oldest first', async () => {
		// as the database gives them: newest first
		const { repository } = createRepository([{ id: 'c' }, { id: 'b' }, { id: 'a' }])

		const rows = await repository.findDayHistory({ userId: 'u1', beforeId: 'm9', since })

		expect(rows.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
	})

	it('filters by the user, the start of the day and the message being answered', async () => {
		const { repository, findMany } = createRepository([])

		await repository.findDayHistory({ userId: 'u1', beforeId: 'm9', since })

		expect(findMany.mock.calls[0]?.[0]).toMatchObject({
			where: { userId: 'u1', id: { lt: 'm9' }, createdAt: { gte: since } },
		})
	})
})

describe('ChatRepository.findHistory', () => {
	it('takes the newest messages before the moment and returns them oldest first', async () => {
		const before = new Date('2026-11-11T19:00:00Z')
		const { repository, findMany } = createRepository([{ id: 'b' }, { id: 'a' }])

		const rows = await repository.findHistory({ userId: 'u1', beforeId: 'm9', before, limit: 6 })

		expect(rows.map(({ id }) => id)).toEqual(['a', 'b'])
		expect(findMany.mock.calls[0]?.[0]).toMatchObject({
			where: { userId: 'u1', createdAt: { lt: before } },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: 6,
		})
	})
})
