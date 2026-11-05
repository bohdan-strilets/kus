import { describe, expect, it } from 'vitest'

import { readStoredProgramView } from './program-card'

const VIEW = {
	v: 1,
	versionId: '0199b3a4-0000-7000-8000-0000000000b1',
	versionCreatedAt: '2026-11-01T10:00:00.000Z',
	program: {
		title: null,
		mode: 'ROTATE',
		perWeek: 2,
		templates: [
			{
				key: '0199b3a4-0000-7000-8000-0000000000a1',
				name: 'А',
				weekdays: [],
				estimatedMin: 10,
				exercises: [
					{
						name: 'Присідання',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'LEGS',
						target: {
							sets: 3,
							repsMin: 8,
							repsMax: 12,
							weightKg: 80,
							progressStepKg: null,
							restSec: null,
							durationMin: null,
							distanceM: null,
						},
					},
				],
			},
		],
		pinnedKey: null,
	},
	nextTemplateKey: null,
}

describe('readStoredProgramView', () => {
	it('reads a valid snapshot', () => {
		expect(readStoredProgramView(VIEW)).toEqual(VIEW)
	})

	it('reads null (no snapshot) as none', () => {
		expect(readStoredProgramView(null)).toBeNull()
	})

	it('reads an unknown version as none', () => {
		expect(readStoredProgramView({ ...VIEW, v: 2 })).toBeNull()
	})

	it('reads a corrupted snapshot as none instead of throwing', () => {
		expect(readStoredProgramView({ v: 1, versionId: 'not-a-uuid' })).toBeNull()
		expect(readStoredProgramView('garbage')).toBeNull()
		expect(readStoredProgramView({ ...VIEW, program: null })).toBeNull()
	})
})
