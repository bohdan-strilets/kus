// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	buildLiveDraft,
	type LiveDraft,
	type LiveDraftExercise,
	type LiveDraftSet,
	type LiveSession,
} from '@/features/live-workout'
import { makeLiveResponse, makePlanExercise, renderWithProviders } from '@/shared/testing'

import { LiveSetList } from './LiveSetList'

interface HarnessProps {
	onSets: (sets: LiveDraftSet[]) => void
	registerUndo: (undo: () => void) => void
}

const Harness = ({ onSets, registerUndo }: HarnessProps) => {
	const [draft] = useState<LiveDraft>(() =>
		buildLiveDraft(makeLiveResponse({ plan: [makePlanExercise({ sets: 3 })] })),
	)
	const [sets, setSets] = useState<LiveDraftSet[]>(draft.exercises[0]?.sets ?? [])
	onSets(sets)
	const exercise = { ...(draft.exercises[0] as LiveDraftExercise), sets }
	// only what LiveSetList reads; the rest of the session is the screen's business
	const session = {
		draft,
		current: null,
		selectSet: vi.fn(),
		changeSet: vi.fn(),
		toggleDone: vi.fn(),
		addSet: vi.fn(),
		addWarmup: vi.fn(),
		deleteSet: ({ setIndex }: { setIndex: number }) => {
			const removed = sets[setIndex]
			if (!removed) return
			setSets((previous) => previous.filter((_, index) => index !== setIndex))
			registerUndo(() => {
				setSets((previous) => [
					...previous.slice(0, setIndex),
					removed,
					...previous.slice(setIndex),
				])
			})
		},
	} as unknown as LiveSession
	return (
		<LiveSetList
			exercise={exercise}
			exerciseIndex={0}
			session={session}
			onDeleteExercise={vi.fn()}
		/>
	)
}

const rowOf = (label: string): HTMLElement =>
	screen.getByRole('button', { name: `Підхід ${label}, змінити` })

const rowCount = (): number =>
	screen.queryAllByRole('button', { name: /^Підхід \d, змінити$/ }).length

const renderList = () => {
	let sets: LiveDraftSet[] = []
	let undo: () => void = () => undefined
	renderWithProviders(
		<Harness
			onSets={(next) => {
				sets = next
			}}
			registerUndo={(next) => {
				undo = next
			}}
		/>,
	)
	return {
		keys: () => sets.map(({ rowKey }) => rowKey),
		undo: () => {
			undo()
		},
	}
}

afterEach(cleanup)

describe('LiveSetList: rows are keyed by rowKey', () => {
	it('the other rows keep their DOM nodes after a removal and after the undo', async () => {
		const list = renderList()
		const first = rowOf('1')
		const third = rowOf('3')
		const keysBefore = list.keys()

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 2', hidden: true }))

		await waitFor(() => {
			expect(rowCount()).toBe(2)
		})
		expect(list.keys()).toEqual([keysBefore[0], keysBefore[2]])
		// the third set is now the second one, in the same element
		expect(rowOf('1')).toBe(first)
		expect(rowOf('2')).toBe(third)
		expect(first.isConnected).toBe(true)
		expect(third.isConnected).toBe(true)

		list.undo()

		await waitFor(() => {
			expect(rowCount()).toBe(3)
		})
		expect(list.keys()).toEqual(keysBefore)
		expect(rowOf('1')).toBe(first)
		expect(rowOf('3')).toBe(third)
	})

	it('after a removal each number is shown once and no aria-hidden number stays behind', async () => {
		renderList()

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 1', hidden: true }))

		await waitFor(() => {
			expect(rowCount()).toBe(2)
		})
		await waitFor(() => {
			const hiddenNumbers = Array.from(document.querySelectorAll('[aria-hidden="true"]')).filter(
				(node) => /^\d$/.test(node.textContent),
			)
			expect(hiddenNumbers).toEqual([])
		})
		const visible = Array.from(document.querySelectorAll('span.relative.inline-block > span'))
			.filter((node) => node.getAttribute('aria-hidden') !== 'true')
			.map((node) => node.textContent)
			.filter((text) => /^\d$/.test(text))
		expect(visible).toEqual(['1', '2'])
	})
})
