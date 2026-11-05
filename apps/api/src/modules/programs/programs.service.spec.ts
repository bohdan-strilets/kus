import { programViewSchema } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import { ProgramsService } from './programs.service'

const USER_ID = 'user-1'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000b1'
const KEY_A = '0199b3a4-0000-7000-8000-0000000000a1'
const KEY_B = '0199b3a4-0000-7000-8000-0000000000a2'
const CREATED_AT = new Date('2026-11-01T10:00:00.000Z')

const template = (key: string, name: string, position: number) => ({
	id: `tpl-${name}`,
	key,
	name,
	position,
	weekdays: [],
	exercises: [
		{
			name: 'Присідання',
			exerciseId: null,
			kind: 'STRENGTH',
			muscleGroup: 'LEGS',
			exercise: null,
			sets: 3,
			repsMin: 8,
			repsMax: 12,
			weightKg: { toNumber: () => 80 },
			progressStepKg: null,
			restSec: null,
			durationMin: null,
			distanceM: null,
		},
	],
})

const activeProgram = {
	id: 'program-1',
	title: null,
	mode: 'ROTATE',
	perWeek: 2,
	pinnedTemplateId: null,
	activeVersionId: VERSION_ID,
	activeVersion: {
		id: VERSION_ID,
		createdAt: CREATED_AT,
		templates: [template(KEY_A, 'А', 0), template(KEY_B, 'Б', 1)],
	},
}

const createService = (program: unknown) => {
	const findActive = vi.fn().mockResolvedValue(program)
	const service = new ProgramsService(
		{ findActive } as never,
		{ findLastTemplatedWorkout: vi.fn().mockResolvedValue(null) } as never,
		{ getMe: vi.fn().mockResolvedValue({ timezone: 'Europe/Warsaw' }) } as never,
		{} as never,
	)
	return { service, findActive }
}

describe('ProgramsService.getActiveView', () => {
	it('returns a v1 snapshot of the active version with the next template key', async () => {
		const { service } = createService(activeProgram)

		const view = await service.getActiveView(USER_ID)

		expect(programViewSchema.safeParse(view).success).toBe(true)
		expect(view).toMatchObject({
			v: 1,
			versionId: VERSION_ID,
			versionCreatedAt: CREATED_AT.toISOString(),
			nextTemplateKey: KEY_A,
		})
		expect(view?.program.templates.map(({ name }) => name)).toEqual(['А', 'Б'])
		expect(view?.program.templates[0]?.exercises[0]?.target.weightKg).toBe(80)
	})

	it('returns null when the user has no program', async () => {
		const { service } = createService(null)

		expect(await service.getActiveView(USER_ID)).toBeNull()
	})

	it('returns null when the program has no active version', async () => {
		const { service } = createService({ ...activeProgram, activeVersion: null })

		expect(await service.getActiveView(USER_ID)).toBeNull()
	})

	it('looks the program up by the token user id only', async () => {
		const { service, findActive } = createService(activeProgram)

		await service.getActiveView(USER_ID)

		expect(findActive).toHaveBeenCalledTimes(1)
		expect(findActive).toHaveBeenCalledWith(USER_ID)
	})
})
