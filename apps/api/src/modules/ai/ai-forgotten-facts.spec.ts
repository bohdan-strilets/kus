import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

const USER_ID = 'u1'
const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

describe('AiRepository.findForgetCallMessageIds', () => {
	it('asks for the successful forget_fact calls of successful parse runs of the user', async () => {
		const findMany = vi.fn().mockResolvedValue([
			{ aiRunId: 'r1', aiRun: { messageId: 'm1', createdAt: new Date('2026-11-06T10:01:00Z') } },
			{ aiRunId: 'r2', aiRun: { messageId: null, createdAt: new Date('2026-11-06T10:01:00Z') } },
			{ aiRunId: 'r1', aiRun: { messageId: 'm1', createdAt: new Date('2026-11-06T10:01:00Z') } },
		])
		const repository = new AiRepository({ aiToolCall: { findMany } } as never)

		const ids = await repository.findForgetCallMessageIds({ userId: USER_ID, messageIds: ['m1'] })

		expect(ids).toEqual([
			{ messageId: 'm1', aiRunId: 'r1', runCreatedAt: new Date('2026-11-06T10:01:00Z') },
			{ messageId: 'm1', aiRunId: 'r1', runCreatedAt: new Date('2026-11-06T10:01:00Z') },
		])
		expect(findMany).toHaveBeenCalledWith({
			where: {
				name: 'forget_fact',
				status: 'SUCCEEDED',
				aiRun: {
					userId: USER_ID,
					messageId: { in: ['m1'] },
					purpose: 'PARSE_FOOD',
					status: 'SUCCEEDED',
				},
			},
			select: { aiRunId: true, aiRun: { select: { messageId: true, createdAt: true } } },
		})
	})
})

describe('AiService.countForgottenFacts', () => {
	const row = (messageId: string, aiRunId: string, minute: number) => ({
		messageId,
		aiRunId,
		runCreatedAt: new Date(`2026-11-06T10:0${minute}:00Z`),
	})

	it('counts the calls per message', async () => {
		const findForgetCallMessageIds = vi
			.fn()
			.mockResolvedValue([row('m1', 'r1', 1), row('m2', 'r2', 1), row('m1', 'r1', 1)])
		const service = new AiService({} as never, { findForgetCallMessageIds } as never, config)

		const counts = await service.countForgottenFacts(USER_ID, ['m1', 'm2', 'm3'])

		expect(counts).toEqual(
			new Map([
				['m1', 2],
				['m2', 1],
			]),
		)
	})

	it('counts only the latest successful run of a message parsed twice', async () => {
		const findForgetCallMessageIds = vi
			.fn()
			.mockResolvedValue([row('m1', 'r1', 1), row('m1', 'r1', 1), row('m1', 'r2', 2)])
		const service = new AiService({} as never, { findForgetCallMessageIds } as never, config)

		expect(await service.countForgottenFacts(USER_ID, ['m1'])).toEqual(new Map([['m1', 1]]))
	})

	it('does not ask without messages', async () => {
		const findForgetCallMessageIds = vi.fn()
		const service = new AiService({} as never, { findForgetCallMessageIds } as never, config)

		expect(await service.countForgottenFacts(USER_ID, [])).toEqual(new Map())
		expect(findForgetCallMessageIds).not.toHaveBeenCalled()
	})
})
