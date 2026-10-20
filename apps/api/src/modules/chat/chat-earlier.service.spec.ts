import { describe, expect, it, vi } from 'vitest'

import { ChatEarlierService } from './chat-earlier.service'

const createService = () => {
	const findDayEntries = vi.fn().mockResolvedValue([])
	const findRecentEntries = vi.fn().mockResolvedValue([])
	const service = new ChatEarlierService({ findDayEntries, findRecentEntries } as never)
	return { service, findDayEntries, findRecentEntries }
}

describe('ChatEarlierService.getContext', () => {
	it('reads nothing and returns no section for a message that does not point back', async () => {
		const { service, findDayEntries, findRecentEntries } = createService()

		const context = await service.getContext({
			userId: 'u1',
			text: '200 г гречки',
			today: '2026-10-19',
		})

		expect(context.earlier).toEqual([])
		expect(findDayEntries).not.toHaveBeenCalled()
		expect(findRecentEntries).not.toHaveBeenCalled()
	})

	it('reads yesterday and the last 30 days of the same user for a message that points back', async () => {
		const { service, findDayEntries, findRecentEntries } = createService()

		await service.getContext({ userId: 'u1', text: 'як вчора', today: '2026-10-19' })

		expect(findDayEntries).toHaveBeenCalledWith('u1', new Date('2026-10-18T00:00:00Z'), 50)
		expect(findRecentEntries).toHaveBeenCalledWith(
			'u1',
			{ from: new Date('2026-09-19T00:00:00Z'), to: new Date('2026-10-18T00:00:00Z') },
			400,
		)
	})
})
