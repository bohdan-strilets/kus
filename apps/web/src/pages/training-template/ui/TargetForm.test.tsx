// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { makeDraft, makeTarget } from '../lib/fixtures'
import { toSaveExercises } from '../lib/template-draft'
import { templateDraftReducer } from '../lib/template-draft.reducer'
import { TargetForm } from './TargetForm'

afterEach(cleanup)

const renderForm = (patch = {}) => {
	const onSave = vi.fn()
	renderWithProviders(
		<TargetForm exercise={makeDraft('a', patch)} onSave={onSave} onRemove={vi.fn()} />,
	)
	return onSave
}

const bodyweightSwitch = (): HTMLElement => screen.getByRole('switch', { name: 'Власна вага' })

describe('TargetForm: «Власна вага»', () => {
	it('shows the weight stepper and the progress step by default, the switch off', () => {
		renderForm()

		expect(bodyweightSwitch().getAttribute('aria-checked')).toBe('false')
		expect(screen.getByText('Робоча вага')).toBeTruthy()
		expect(screen.getByText('Крок прогресу')).toBeTruthy()
	})

	it('turning it on hides the weight and the step', () => {
		renderForm()

		fireEvent.click(bodyweightSwitch())

		expect(bodyweightSwitch().getAttribute('aria-checked')).toBe('true')
		expect(screen.queryByText('Робоча вага')).toBeNull()
		expect(screen.queryByText('Крок прогресу')).toBeNull()
	})

	it('saves weightKg and progressStepKg as null with isBodyweight true', () => {
		const onSave = renderForm()

		fireEvent.click(bodyweightSwitch())
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		expect(onSave).toHaveBeenCalledTimes(1)
		const [target, isBodyweight] = onSave.mock.calls[0] as [ReturnType<typeof makeTarget>, boolean]
		expect(target).toMatchObject({
			weightKg: null,
			progressStepKg: null,
			sets: 3,
			repsMin: 8,
			repsMax: 12,
		})
		expect(isBodyweight).toBe(true)
	})

	it('saves isBodyweight null when the switch was never touched (the dictionary decides)', () => {
		const onSave = renderForm()

		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		expect(onSave.mock.calls[0]?.[1]).toBeNull()
		expect(onSave.mock.calls[0]?.[0]).toMatchObject({ weightKg: 50, progressStepKg: 2.5 })
	})

	it('starts with the switch on for an exercise already marked bodyweight', () => {
		renderForm({ isBodyweight: true, target: makeTarget({ weightKg: null, progressStepKg: null }) })

		expect(bodyweightSwitch().getAttribute('aria-checked')).toBe('true')
		expect(screen.queryByText('Робоча вага')).toBeNull()
	})

	it('turning it off again keeps the weight empty and saves isBodyweight false', () => {
		const onSave = renderForm()

		fireEvent.click(bodyweightSwitch())
		fireEvent.click(bodyweightSwitch())
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		expect(onSave.mock.calls[0]?.[1]).toBe(false)
		expect(onSave.mock.calls[0]?.[0]).toMatchObject({ weightKg: null })
	})

	it('has no switch for cardio', () => {
		renderForm({
			kind: 'CARDIO',
			muscleGroup: null,
			target: makeTarget({
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: null,
				restSec: null,
				durationMin: 20,
			}),
		})

		expect(screen.queryByRole('switch')).toBeNull()
	})
})

describe('template draft: isBodyweight', () => {
	const list = [makeDraft('a'), makeDraft('b')]

	it('setTarget with isBodyweight writes it to that row only', () => {
		const next = templateDraftReducer(list, {
			type: 'setTarget',
			key: 'a',
			target: makeTarget({ weightKg: null }),
			isBodyweight: true,
		})

		expect(next[0]).toMatchObject({ isBodyweight: true, target: { weightKg: null } })
		expect(next[1]?.isBodyweight).toBeUndefined()
	})

	it("setTarget without isBodyweight leaves the row's value alone", () => {
		const start = [makeDraft('a', { isBodyweight: true })]

		const next = templateDraftReducer(start, {
			type: 'setTarget',
			key: 'a',
			target: makeTarget({ sets: 5 }),
		})

		expect(next[0]).toMatchObject({ isBodyweight: true, target: { sets: 5 } })
	})

	it('setTarget with null clears the choice', () => {
		const start = [makeDraft('a', { isBodyweight: true })]

		const next = templateDraftReducer(start, {
			type: 'setTarget',
			key: 'a',
			target: makeTarget(),
			isBodyweight: null,
		})

		expect(next[0]?.isBodyweight).toBeNull()
	})

	it('toSaveExercises passes isBodyweight (true, false, null) and omits it for an old row', () => {
		const saved = toSaveExercises([
			makeDraft('a', { isBodyweight: true }),
			makeDraft('b', { isBodyweight: false }),
			makeDraft('c', { isBodyweight: null }),
			makeDraft('d'),
		])

		expect(saved.map((exercise) => exercise.isBodyweight)).toEqual([true, false, null, undefined])
		expect(saved[3]).not.toHaveProperty('isBodyweight')
		expect(saved[0]).not.toHaveProperty('key')
		expect(saved[0]).not.toHaveProperty('lastSets')
	})
})

describe('TargetForm: tap zone of «Власна вага»', () => {
	it('has a ≥ 44px row and an extended ::after hitbox on the switch', () => {
		renderForm()

		const classes = bodyweightSwitch().className.split(' ')
		const row = bodyweightSwitch().parentElement as HTMLElement

		// jsdom cannot measure pseudo-elements, so the hitbox is checked by its classes
		expect(classes).toContain('relative')
		expect(classes).toContain('after:absolute')
		expect(classes).toContain('after:-inset-y-2')
		expect(row.className).toContain('min-h-tap')
	})
})
