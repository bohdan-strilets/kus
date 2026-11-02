import type { ProgramDraft, ProgramResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { toProgramChatContext } from './program-chat-context'

const TARGET = {
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const exercise = (name: string, exerciseId: string | null = null) => ({
	name,
	exerciseId,
	kind: 'STRENGTH' as const,
	muscleGroup: null,
	target: TARGET,
})

const responseTemplate = (id: string, key: string, name: string, position: number) => ({
	id,
	key,
	name,
	position,
	weekdays: [],
	estimatedMin: 40,
	muscleGroups: [],
	hasCardio: false,
	exercises: [
		{
			...exercise('Жим лежачи', 'bench-id'),
			id: `${id}-e`,
			position: 0,
			lastSets: null,
			lastPerformedAt: null,
			isBodyweight: null,
			progressHintKg: null,
		},
	],
})

/** Б listed before А: the refs follow the position, not the order of the array. */
const ACTIVE: ProgramResponse = {
	id: 'program-1',
	title: null,
	mode: 'ROTATE',
	perWeek: 2,
	pinnedTemplateId: null,
	version: { id: 'version-1', createdAt: '2026-11-01T10:00:00.000Z' },
	templates: [
		responseTemplate('template-b', 'key-b', 'Тренування Б', 1),
		responseTemplate('template-a', 'key-a', 'Тренування А', 0),
	],
	next: null,
}

const draftTemplate = (key: string, name: string) => ({
	key,
	name,
	weekdays: [],
	exercises: [exercise('Присідання')],
	estimatedMin: 40,
})

const PENDING: ProgramDraft = {
	title: null,
	mode: 'ROTATE',
	perWeek: 3,
	pinnedKey: null,
	templates: [
		draftTemplate('key-b', 'Тренування Б'),
		draftTemplate('key-new', 'Тренування В'),
		draftTemplate('key-a', 'Тренування А'),
	],
}

describe('toProgramChatContext', () => {
	it('numbers the active templates by position and the proposal by key, new ones after', () => {
		const { program, pendingProgram, refIds } = toProgramChatContext(
			ACTIVE,
			new Map([['bench-id', 'x1']]),
			PENDING,
		)

		expect(program?.templates.map(({ ref, name }) => `${ref} ${name}`)).toEqual([
			't1 Тренування А',
			't2 Тренування Б',
		])
		expect(program?.templates[0]?.exercises[0]?.exerciseRef).toBe('x1')
		expect(pendingProgram?.templates.map(({ ref, name }) => `${ref} ${name}`)).toEqual([
			't2 Тренування Б',
			't3 Тренування В',
			't1 Тренування А',
		])
		expect(pendingProgram?.perWeek).toBe(3)
		expect([...refIds.keys]).toEqual([
			['t1', 'key-a'],
			['t2', 'key-b'],
			['t3', 'key-new'],
		])
		// a proposal-only t-ref names no template of the active version: log_workout cannot bind it
		expect([...refIds.ids]).toEqual([
			['t1', 'template-a'],
			['t2', 'template-b'],
		])
		expect(refIds.baseVersionId).toBe('version-1')
	})

	it('shows a proposal alone without a program, from t1, with no base version', () => {
		const { program, pendingProgram, refIds } = toProgramChatContext(null, new Map(), PENDING)

		expect(program).toBeNull()
		expect(pendingProgram?.templates.map(({ ref }) => ref)).toEqual(['t1', 't2', 't3'])
		expect(refIds.ids.size).toBe(0)
		expect(refIds.keys.get('t2')).toBe('key-new')
		expect(refIds.baseVersionId).toBeNull()
	})

	it('has no proposal without an open card', () => {
		expect(toProgramChatContext(ACTIVE, new Map()).pendingProgram).toBeNull()
	})
})
