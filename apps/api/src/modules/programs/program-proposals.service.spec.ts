import { Logger } from '@nestjs/common'
import { PROGRAM_TEMPLATES_MAX, type ProposeProgramInput } from '@kus/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProgramProposalsService } from './program-proposals.service'

beforeEach(() => {
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
})

const INPUT: ProposeProgramInput = {
	title: null,
	mode: 'ROTATE',
	perWeek: 2,
	pinnedRef: null,
	templates: [
		{
			ref: null,
			name: 'Тренування А',
			weekdays: [],
			exercises: [
				{
					name: 'Присідання',
					exerciseRef: null,
					kind: 'STRENGTH',
					muscleGroup: null,
					sets: 3,
					repsMin: 8,
					repsMax: 12,
					weightKg: null,
					restSec: null,
					durationMin: null,
					distanceKm: null,
				},
			],
		},
	],
	reply: 'Ось програма.',
}

const REFS = { templateKeys: new Map(), exerciseIds: new Map() }

/** No program in the database. */
const createService = () => {
	const findExercisesByNames = vi.fn().mockResolvedValue([null])
	const service = new ProgramProposalsService(
		{} as never,
		{ findActive: vi.fn().mockResolvedValue(null) } as never,
		{} as never,
		{} as never,
		{ findExercisesByNames } as never,
	)
	return { service, findExercisesByNames }
}

describe('ProgramProposalsService.buildProposalCard', () => {
	it('builds no card when the program is not the one the context showed', async () => {
		const { service, findExercisesByNames } = createService()

		const result = await service.buildProposalCard('u1', INPUT, {
			refs: REFS,
			contextVersionId: 'version-removed-meanwhile',
		})

		expect(result).toEqual({ status: 'BASE_CHANGED' })
		expect(findExercisesByNames).not.toHaveBeenCalled()
	})

	it('builds the first program as a card when there was none at context time either', async () => {
		const { service } = createService()

		const result = await service.buildProposalCard('u1', INPUT, {
			refs: REFS,
			contextVersionId: null,
		})

		expect(result.status).toBe('CARD')
		expect(result.status === 'CARD' && result.card.baseVersionId).toBeNull()
	})

	it('builds no card, and logs ids only, when the built card does not parse', async () => {
		const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
		const { service } = createService()
		// more templates than a program holds: the card schema refuses it
		const template = INPUT.templates.at(0)
		if (!template) throw new Error('fixture has a template')
		const input = {
			...INPUT,
			templates: Array.from({ length: PROGRAM_TEMPLATES_MAX + 1 }, (_, index) => ({
				...template,
				name: `Тренування ${index}`,
			})),
		}

		const result = await service.buildProposalCard('u1', input, {
			refs: REFS,
			contextVersionId: null,
		})

		expect(result).toEqual({ status: 'INVALID' })
		expect(warn).toHaveBeenCalledOnce()
		expect(String(warn.mock.calls[0]?.[0])).not.toContain('Тренування')
	})
})
