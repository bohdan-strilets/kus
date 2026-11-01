// @vitest-environment jsdom
import type { ProgramCard, ProgramChangeLine } from '@kus/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import type { ProgramCardControls } from './program-card.types'
import { ProgramDiffCard } from './ProgramDiffCard'
import { ProgramProposalCard } from './ProgramProposalCard'

const KEY = '0199b3a4-0000-7000-8000-000000000001'
const EMPTY_TARGET = {
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const makeCard = (isInitial: boolean, lines: ProgramChangeLine[] = []): ProgramCard => ({
	v: 1,
	baseVersionId: isInitial ? null : KEY,
	program: {
		title: null,
		mode: 'ROTATE',
		perWeek: 3,
		pinnedKey: null,
		templates: [
			{
				key: KEY,
				name: 'Тренування А',
				weekdays: [],
				estimatedMin: 55,
				exercises: [
					{
						name: 'Жим лежачи',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'CHEST',
						target: { ...EMPTY_TARGET, sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 },
					},
					{
						name: 'Бігова доріжка',
						exerciseId: null,
						kind: 'CARDIO',
						muscleGroup: null,
						target: { ...EMPTY_TARGET, durationMin: 10 },
					},
				],
			},
		],
	},
	changes: { v: 1, initial: isInitial, lines, unchangedTemplates: 0 },
})

const onAccept = vi.fn()
const onRebase = vi.fn()
const onModify = vi.fn()

const controls = (patch: Partial<ProgramCardControls> = {}): ProgramCardControls => ({
	status: 'OPEN',
	versionCreatedAt: null,
	pendingAction: null,
	onAccept,
	onRebase,
	onModify,
	...patch,
})

const renderProposal = (patch: Partial<ProgramCardControls> = {}, isFromOnboarding = false) =>
	render(
		<MemoryRouter>
			<ProgramProposalCard
				card={makeCard(true)}
				controls={controls(patch)}
				isFromOnboarding={isFromOnboarding}
			/>
		</MemoryRouter>,
	)

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('ProgramProposalCard', () => {
	it('shows the title, the mode, a template with its meta and the note', () => {
		renderProposal()

		expect(screen.getByRole('heading', { name: 'Програма: 1 тренування' })).toBeTruthy()
		expect(screen.getByText('По черзі · 3 рази на тиждень')).toBeTruthy()
		expect(screen.getByText('Тренування А')).toBeTruthy()
		expect(screen.getByText(/1 вправа \+ кардіо · ~55 хв/)).toBeTruthy()
		expect(screen.getByText('Поки не збережено — лише після «Прийняти».')).toBeTruthy()
	})

	it('counts the answers in the note after the onboarding', () => {
		renderProposal({}, true)
		expect(screen.getByText('Складено з 5 відповідей. Поки не збережено.')).toBeTruthy()
	})

	it('unfolds the exercises of a template on a tap', () => {
		renderProposal()
		const row = screen.getByRole('button', { name: /Тренування А/ })

		expect(row.getAttribute('aria-expanded')).toBe('false')
		fireEvent.click(row)

		expect(row.getAttribute('aria-expanded')).toBe('true')
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('3 × 8–12 · 60 кг')).toBeTruthy()
	})

	it('accepts and asks to change in the chat', () => {
		renderProposal()

		fireEvent.click(screen.getByRole('button', { name: 'Прийняти' }))
		fireEvent.click(screen.getByRole('button', { name: 'Змінити в чаті' }))

		expect(onAccept).toHaveBeenCalledOnce()
		expect(onModify).toHaveBeenCalledOnce()
	})

	it('does not accept twice while the accept is in flight', () => {
		renderProposal({ pendingAction: 'accept' })

		fireEvent.click(screen.getByRole('button', { name: 'Змінити в чаті' }))
		fireEvent.click(screen.getByRole('button', { name: 'Прийняти' }))

		expect(onModify).not.toHaveBeenCalled()
		expect(onAccept).not.toHaveBeenCalled()
	})

	it('after the accept: the plaque with the version date and the link, no buttons', () => {
		renderProposal({ status: 'ACCEPTED', versionCreatedAt: '2026-10-31T10:00:00.000Z' })

		expect(screen.getByText('Прийнято · версія від 31.10')).toBeTruthy()
		expect(screen.getByRole('link', { name: 'Відкрити програму' }).getAttribute('href')).toBe(
			'/app/training/program',
		)
		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
	})

	it('a replaced card has no buttons and no plaque', () => {
		renderProposal({ status: 'REPLACED' })

		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
		expect(screen.queryByRole('link')).toBeNull()
	})

	it('an outdated card offers «Перерахувати» instead of «Прийняти»', () => {
		renderProposal({ status: 'OUTDATED' })

		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Перерахувати' }))
		expect(onRebase).toHaveBeenCalledOnce()
	})
})

describe('ProgramDiffCard', () => {
	it('lists the changes with words for the colours and one «Прийняти»', () => {
		const lines: ProgramChangeLine[] = [
			{
				op: 'REMOVE',
				scope: 'EXERCISE',
				templateName: 'Тренування А',
				name: 'Жим ногами',
				field: null,
				before: null,
				after: null,
			},
		]
		render(
			<MemoryRouter>
				<ProgramDiffCard
					card={makeCard(false, lines)}
					controls={controls({ onModify: undefined })}
				/>
			</MemoryRouter>,
		)

		expect(screen.getByRole('heading', { name: 'Зміни в програмі', level: 3 })).toBeTruthy()
		expect(screen.getByText('Прибрано')).toBeTruthy()
		expect(screen.getByText('Жим ногами')).toBeTruthy()
		expect(screen.getByText('Решта без змін. Поки не збережено.')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Змінити в чаті' })).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Прийняти' }))
		expect(onAccept).toHaveBeenCalledOnce()
	})
})
