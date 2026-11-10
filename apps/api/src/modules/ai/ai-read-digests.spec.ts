import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

const USER_ID = 'u1'
const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

describe('AiRepository.findReadCalls', () => {
	it('asks for the successful read calls of successful parse runs of the user, oldest first', async () => {
		const findMany = vi.fn().mockResolvedValue([
			{
				result: { text: 'a', digest: 'read workouts 01.11–10.11: 3' },
				createdAt: new Date('2026-11-10T10:00:00Z'),
				aiRun: { messageId: 'm1' },
			},
			{ result: { text: 'b' }, createdAt: new Date(), aiRun: { messageId: null } },
			{ result: null, createdAt: new Date(), aiRun: { messageId: 'm1' } },
		])
		const repository = new AiRepository({ aiToolCall: { findMany } } as never)

		const rows = await repository.findReadCalls({ userId: USER_ID, messageIds: ['m1'] })

		expect(rows).toEqual([
			{
				messageId: 'm1',
				result: { text: 'a', digest: 'read workouts 01.11–10.11: 3' },
				createdAt: new Date('2026-11-10T10:00:00Z'),
			},
		])
		expect(findMany).toHaveBeenCalledWith({
			where: {
				name: { in: ['find_food', 'get_workouts'] },
				status: 'SUCCEEDED',
				// another user's run never matches: the filter is the user of the token
				aiRun: {
					userId: USER_ID,
					messageId: { in: ['m1'] },
					purpose: 'PARSE_FOOD',
					status: 'SUCCEEDED',
				},
			},
			select: { result: true, createdAt: true, aiRun: { select: { messageId: true } } },
			orderBy: { createdAt: 'asc' },
		})
	})
})

describe('AiService.findReadDigests', () => {
	const row = (messageId: string, result: unknown) => ({
		messageId,
		result,
		createdAt: new Date('2026-11-10T10:00:00Z'),
	})
	const create = (rows: unknown[]) => {
		const findReadCalls = vi.fn().mockResolvedValue(rows)
		return {
			service: new AiService({} as never, { findReadCalls } as never, config),
			findReadCalls,
		}
	}

	it('groups the digests per message in the order of the calls', async () => {
		const { service, findReadCalls } = create([
			row('m1', { text: 'x', digest: 'read workouts 01.11–10.11: 3' }),
			row('m2', { text: 'y', digest: 'looked up food "батончик": 2 found' }),
			row('m1', { text: 'z', digest: 'looked up food "чай": 0 found' }),
		])

		const digests = await service.findReadDigests(USER_ID, ['m1', 'm2'])

		expect(digests).toEqual(
			new Map([
				['m1', ['read workouts 01.11–10.11: 3', 'looked up food "чай": 0 found']],
				['m2', ['looked up food "батончик": 2 found']],
			]),
		)
		expect(findReadCalls).toHaveBeenCalledWith({ userId: USER_ID, messageIds: ['m1', 'm2'] })
	})

	it('skips calls stored without a digest and anything that is not an object with a text digest', async () => {
		const { service } = create([
			row('m1', { text: 'old row, no digest' }),
			row('m1', 'a string'),
			row('m1', ['list']),
			row('m1', { digest: 42 }),
			row('m1', { digest: '' }),
		])

		expect(await service.findReadDigests(USER_ID, ['m1'])).toEqual(new Map())
	})

	it('repeats a retried read once and keeps the last two of a turn', async () => {
		const { service } = create([
			row('m1', { digest: 'a' }),
			row('m1', { digest: 'a' }),
			row('m1', { digest: 'b' }),
			row('m1', { digest: 'c' }),
		])

		expect(await service.findReadDigests(USER_ID, ['m1'])).toEqual(new Map([['m1', ['b', 'c']]]))
	})

	it('does not ask without messages', async () => {
		const { service, findReadCalls } = create([])

		expect(await service.findReadDigests(USER_ID, [])).toEqual(new Map())
		expect(findReadCalls).not.toHaveBeenCalled()
	})
})
