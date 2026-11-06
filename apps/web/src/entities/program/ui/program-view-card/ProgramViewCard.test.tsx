// @vitest-environment jsdom
import type { ProgramTemplateDraft, ProgramView } from '@kus/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { ProgramViewCard } from './ProgramViewCard'

const KEY_A = '0199b3a4-0000-7000-8000-00000000000a'
const KEY_B = '0199b3a4-0000-7000-8000-00000000000b'
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

const makeTemplate = (key: string, name: string): ProgramTemplateDraft => ({
	key,
	name,
	weekdays: [],
	estimatedMin: 55,
	exercises: [
		{
			name: `Жим ${name}`,
			exerciseId: null,
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			target: { ...EMPTY_TARGET, sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 },
		},
	],
})

const makeView = (templateCount: number, nextTemplateKey: string | null = KEY_A): ProgramView => ({
	v: 1,
	versionId: KEY_B,
	versionCreatedAt: new Date(2026, 9, 31, 20, 15).toISOString(),
	nextTemplateKey,
	program: {
		title: 'Все тіло',
		mode: 'ROTATE',
		perWeek: 3,
		pinnedKey: null,
		templates: Array.from({ length: templateCount }, (_, index) =>
			makeTemplate(
				index === 0 ? KEY_A : `0199b3a4-0000-7000-8000-0000000001${String(index).padStart(2, '0')}`,
				`Тренування ${String.fromCharCode(1040 + index)}`,
			),
		),
	},
})

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>

const renderCard = (view: ProgramView) =>
	render(
		<MemoryRouter initialEntries={['/app/chat']}>
			<ProgramViewCard view={view} />
			<LocationProbe />
		</MemoryRouter>,
	)

describe('ProgramViewCard', () => {
	afterEach(cleanup)

	it.each([
		[1, 'Твоя програма: 1 тренування'],
		[3, 'Твоя програма: 3 тренування'],
		[5, 'Твоя програма: 5 тренувань'],
	])('pluralizes the header for %i templates', (count, title) => {
		renderCard(makeView(count))
		expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(title)
	})

	it('shows the subtitle with the next template', () => {
		renderCard(makeView(2))
		expect(screen.getByText('Все тіло · по черзі · 3 рази на тиждень · наступне — А')).toBeTruthy()
	})

	it('has no «next» part when nextTemplateKey is null', () => {
		renderCard(makeView(2, null))
		expect(screen.getByText('Все тіло · по черзі · 3 рази на тиждень')).toBeTruthy()
		expect(screen.queryByText(/наступне/)).toBeNull()
	})

	it('keeps the exercises folded until a template is tapped', () => {
		renderCard(makeView(2))
		expect(screen.queryByText('Жим Тренування А')).toBeNull()
		const [first] = screen.getAllByRole('button')
		expect(first?.getAttribute('aria-expanded')).toBe('false')
		fireEvent.click(first as HTMLElement)
		expect(first?.getAttribute('aria-expanded')).toBe('true')
		expect(screen.getByText('Жим Тренування А')).toBeTruthy()
		expect(screen.queryByText('Жим Тренування Б')).toBeNull()
	})

	it('stacks the plan under the exercise name, in separate elements', () => {
		renderCard(makeView(1))
		fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement)
		const name = screen.getByText('Жим Тренування А')
		const plan = screen.getByText(/3 підходи/)
		expect(name).not.toBe(plan)
		expect(name.parentElement).toBe(plan.parentElement)
		expect(name.parentElement?.className).toContain('flex-col')
	})

	it('tells the date of the version', () => {
		renderCard(makeView(1))
		expect(screen.getByText('Версія від 31.10.')).toBeTruthy()
	})

	it('shows only the pinned template in SINGLE, with the others as one quiet line', () => {
		const view = makeView(2)
		renderCard({ ...view, program: { ...view.program, mode: 'SINGLE', pinnedKey: KEY_A } })
		expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
			'Твоя програма: 1 тренування',
		)
		expect(screen.getAllByRole('button')).toHaveLength(1)
		expect(screen.getByText(/Тренування А/)).toBeTruthy()
		expect(screen.queryByText(/Тренування Б/)).toBeNull()
		expect(screen.getByText('+1 шаблон у програмі')).toBeTruthy()
	})

	it('has no «шаблон у програмі» line in the rotation', () => {
		renderCard(makeView(3))
		expect(screen.getAllByRole('button')).toHaveLength(3)
		expect(screen.queryByText(/шаблон.* у програмі/)).toBeNull()
	})

	it('navigates to the program screen on «Відкрити програму»', () => {
		renderCard(makeView(1))
		const link = screen.getByRole('link', { name: 'Відкрити програму' })
		expect(link.getAttribute('href')).toBe('/app/training/program')
		expect(screen.getByTestId('location').textContent).toBe('/app/chat')
		fireEvent.click(link)
		expect(screen.getByTestId('location').textContent).toBe('/app/training/program')
	})
})
