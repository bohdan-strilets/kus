import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import type { Prisma } from '../../generated/prisma/client'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

const USER_ID = 'u1'
const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

describe('AiRepository.setFoodCallResults', () => {
	it('writes the food id on the calls of the latest parse run, found by their ref', async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 1 })
		const findFirst = vi.fn().mockResolvedValue({ id: 'run-2' })
		const tx = {
			aiRun: { findFirst },
			aiToolCall: { updateMany },
		} as unknown as Prisma.TransactionClient
		const repository = new AiRepository({} as never)

		await repository.setFoodCallResults(
			{
				userId: USER_ID,
				messageId: 'msg-1',
				results: [
					{ name: 'forget_food', ref: 'm2', myFoodId: 'food-1' },
					{ name: 'restore_food', ref: 'g1', myFoodId: 'food-2' },
				],
			},
			tx,
		)

		expect(findFirst).toHaveBeenCalledWith({
			where: { userId: USER_ID, messageId: 'msg-1', purpose: 'PARSE_FOOD', status: 'SUCCEEDED' },
			orderBy: { createdAt: 'desc' },
			select: { id: true },
		})
		expect(updateMany).toHaveBeenNthCalledWith(1, {
			where: { aiRunId: 'run-2', name: 'forget_food', input: { path: ['ref'], equals: 'm2' } },
			data: { result: { myFoodId: 'food-1' } },
		})
		expect(updateMany).toHaveBeenNthCalledWith(2, {
			where: { aiRunId: 'run-2', name: 'restore_food', input: { path: ['ref'], equals: 'g1' } },
			data: { result: { myFoodId: 'food-2' } },
		})
	})

	it('touches nothing without results', async () => {
		const findFirst = vi.fn()
		const repository = new AiRepository({} as never)

		await repository.setFoodCallResults({ userId: USER_ID, messageId: 'msg-1', results: [] }, {
			aiRun: { findFirst },
		} as unknown as Prisma.TransactionClient)

		expect(findFirst).not.toHaveBeenCalled()
	})
})

describe('AiRepository.findFoodCalls', () => {
	it('returns only the calls that stored a food id, of the user and successful runs', async () => {
		const findMany = vi.fn().mockResolvedValue([
			{
				aiRunId: 'r1',
				name: 'forget_food',
				result: { myFoodId: 'f1' },
				createdAt: new Date(),
				aiRun: { messageId: 'm1', createdAt: new Date('2026-11-11T10:00:00Z') },
			},
			{
				aiRunId: 'r1',
				name: 'forget_food',
				result: null,
				createdAt: new Date(),
				aiRun: { messageId: 'm1', createdAt: new Date('2026-11-11T10:00:00Z') },
			},
		])
		const repository = new AiRepository({ aiToolCall: { findMany } } as never)

		const rows = await repository.findFoodCalls({ userId: USER_ID, messageIds: ['m1'] })

		expect(rows).toEqual([
			{
				messageId: 'm1',
				aiRunId: 'r1',
				runCreatedAt: new Date('2026-11-11T10:00:00Z'),
				name: 'forget_food',
				myFoodId: 'f1',
			},
		])
		expect(findMany).toHaveBeenCalledWith({
			where: {
				name: { in: ['forget_food', 'restore_food'] },
				status: 'SUCCEEDED',
				aiRun: {
					userId: USER_ID,
					messageId: { in: ['m1'] },
					purpose: 'PARSE_FOOD',
					status: 'SUCCEEDED',
				},
			},
			select: {
				aiRunId: true,
				name: true,
				result: true,
				createdAt: true,
				aiRun: { select: { messageId: true, createdAt: true } },
			},
			orderBy: { createdAt: 'asc' },
		})
	})
})

describe('AiService.findFoodActions', () => {
	const row = (name: string, aiRunId: string, minute: number, myFoodId: string) => ({
		messageId: 'm1',
		aiRunId,
		runCreatedAt: new Date(`2026-11-11T10:0${minute}:00Z`),
		name,
		myFoodId,
	})

	it('splits removed and restored foods and counts only the latest run of a message', async () => {
		const findFoodCalls = vi
			.fn()
			.mockResolvedValue([
				row('forget_food', 'r1', 1, 'old'),
				row('forget_food', 'r2', 2, 'f1'),
				row('restore_food', 'r2', 2, 'f2'),
				row('forget_food', 'r2', 2, 'f1'),
			])
		const service = new AiService({} as never, { findFoodCalls } as never, config)

		const actions = await service.findFoodActions(USER_ID, ['m1'])

		expect(actions).toEqual(new Map([['m1', { forgotten: ['f1'], restored: ['f2'] }]]))
	})

	it('asks for nothing without messages', async () => {
		const findFoodCalls = vi.fn()
		const service = new AiService({} as never, { findFoodCalls } as never, config)

		expect(await service.findFoodActions(USER_ID, [])).toEqual(new Map())
		expect(findFoodCalls).not.toHaveBeenCalled()
	})
})
