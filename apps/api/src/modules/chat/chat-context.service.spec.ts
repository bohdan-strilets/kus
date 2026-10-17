import { describe, expect, it, vi } from 'vitest'

import { MessageRole } from '../../generated/prisma/client'
import { ChatContextService } from './chat-context.service'

const toEntry = (id: string, sourceMessageId: string | null) => ({
	id,
	sourceMessageId,
	name: id,
	grams: 100,
	kcal: 100,
	proteinG: 1,
	fatG: 1,
	carbsG: 1,
	fiberG: 0,
	category: 'OTHER',
	source: 'ESTIMATE',
	isEdited: false,
	meal: { type: 'LUNCH' },
})

const toUserMessage = (id: string, content: string) => ({
	id,
	role: MessageRole.USER,
	content,
	attachments: [],
})

describe('ChatContextService.buildContext history markers', () => {
	it('marks a turn logged also when its entries fell out of the context window', async () => {
		// the window holds only entry "in-window"; "out-of-window" (message m1) was trimmed away
		const service = new ChatContextService(
			{
				findHistory: vi
					.fn()
					.mockResolvedValue([toUserMessage('m2', 'чай'), toUserMessage('m1', 'борщ')]),
			} as never,
			{ findOpenClarifications: vi.fn().mockResolvedValue([]) } as never,
			{
				getDaySummary: vi.fn().mockResolvedValue({ totals: {}, meals: [] }),
				getEditableEntries: vi.fn().mockResolvedValue({
					active: [toEntry('in-window', 'm2')],
					deleted: [],
					sourceMessages: [
						{ id: 'out-of-window', sourceMessageId: 'm1' },
						{ id: 'in-window', sourceMessageId: 'm2' },
					],
				}),
			} as never,
			{ getGoalForDate: vi.fn().mockResolvedValue(null) } as never,
			{
				findRecent: vi.fn().mockResolvedValue([]),
				findLatest: vi.fn().mockResolvedValue(null),
			} as never,
			{ findTargetWeightKg: vi.fn().mockResolvedValue(null) } as never,
		)

		const { context } = await service.buildContext({
			userId: 'u1',
			timezone: 'Europe/Warsaw',
			message: toUserMessage('m3', 'ще') as never,
			now: new Date('2026-10-18T10:00:00Z'),
			localDate: new Date('2026-10-18T00:00:00Z'),
			memory: [],
		})

		expect(context.history).toEqual([
			{ role: 'user', content: 'борщ', hasLoggedEntries: true },
			{ role: 'user', content: 'чай', loggedRefs: ['e1'] },
		])
	})
})
