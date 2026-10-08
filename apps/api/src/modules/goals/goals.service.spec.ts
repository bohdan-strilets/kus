import { Logger } from '@nestjs/common'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserGoal } from '../../generated/prisma/client'
import type { UsersService } from '../users/users.service'
import type { GoalsRepository } from './goals.repository'
import { GoalsService } from './goals.service'

const USER_ID = '01999a00-0000-7000-8000-000000000001'
const REQUEST = { kcal: 2200, protein: 140, carbs: 225, fat: 80 }

const storedGoal = (overrides: Partial<UserGoal>): UserGoal => ({
	id: '01999a00-0000-7000-8000-0000000000b1',
	userId: USER_ID,
	type: 'MAINTAIN',
	targetWeightKg: null,
	dailyKcal: 2200,
	proteinG: 140,
	fatG: 80,
	carbsG: 225,
	validFrom: new Date('2026-10-08T00:00:00Z'),
	createdAt: new Date(),
	...overrides,
})

describe('GoalsService.setCurrentGoal', () => {
	const repository = {
		findForDate: vi.fn<GoalsRepository['findForDate']>(),
		upsertForDate: vi.fn<GoalsRepository['upsertForDate']>(),
	}
	const users = { getMe: vi.fn().mockResolvedValue({ timezone: 'Europe/Warsaw' }) }
	const service = new GoalsService(
		repository as unknown as GoalsRepository,
		users as unknown as UsersService,
	)
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	beforeEach(() => {
		repository.findForDate.mockReset()
		repository.upsertForDate.mockReset().mockResolvedValue(storedGoal({}))
	})

	afterAll(() => {
		logSpy.mockRestore()
	})

	it('starts a first goal as MAINTAIN from the user’s today', async () => {
		repository.findForDate.mockResolvedValue(null)

		await expect(service.setCurrentGoal(USER_ID, REQUEST)).resolves.toEqual(REQUEST)

		const [params] = repository.upsertForDate.mock.calls[0] ?? []
		expect(params?.values).toEqual({
			type: 'MAINTAIN',
			dailyKcal: 2200,
			proteinG: 140,
			fatG: 80,
			carbsG: 225,
		})
		expect(params?.validFrom.toISOString()).toMatch(/T00:00:00\.000Z$/)
	})

	it('keeps the type of the goal in force', async () => {
		repository.findForDate.mockResolvedValue(storedGoal({ type: 'LOSE' }))

		await service.setCurrentGoal(USER_ID, REQUEST)

		expect(repository.upsertForDate.mock.calls[0]?.[0].values.type).toBe('LOSE')
	})
})
