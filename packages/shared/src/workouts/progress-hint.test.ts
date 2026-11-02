import { describe, expect, it } from 'vitest'

import { DEFAULT_PROGRESS_STEP_KG } from '../schemas/programs.js'
import {
	getProgressHintKg,
	type GetProgressHintInput,
	type ProgressHintSet,
} from './progress-hint.js'

const set = (overrides: Partial<ProgressHintSet> = {}): ProgressHintSet => ({
	reps: 12,
	weightKg: 50,
	isWarmup: false,
	...overrides,
})

const input = (overrides: Partial<GetProgressHintInput> = {}): GetProgressHintInput => ({
	lastSets: [set(), set(), set()],
	repsMax: 12,
	weightKg: null,
	progressStepKg: null,
	isBodyweight: null,
	...overrides,
})

describe('getProgressHintKg', () => {
	it('adds the default step when every set reached repsMax at the same weight', () => {
		expect(getProgressHintKg(input())).toBe(50 + DEFAULT_PROGRESS_STEP_KG)
	})

	it('uses a custom step', () => {
		expect(getProgressHintKg(input({ progressStepKg: 5 }))).toBe(55)
	})

	it('accepts reps above repsMax', () => {
		const lastSets = [set({ reps: 15 }), set({ reps: 12 })]
		expect(getProgressHintKg(input({ lastSets }))).toBe(52.5)
	})

	it('is null when one set is below repsMax', () => {
		expect(getProgressHintKg(input({ lastSets: [set(), set({ reps: 11 }), set()] }))).toBeNull()
	})

	it('is null when a set has no reps', () => {
		expect(getProgressHintKg(input({ lastSets: [set(), set({ reps: null })] }))).toBeNull()
	})

	it('is null when weights differ', () => {
		expect(getProgressHintKg(input({ lastSets: [set(), set({ weightKg: 45 })] }))).toBeNull()
	})

	it('is null for a bodyweight exercise', () => {
		expect(getProgressHintKg(input({ isBodyweight: true }))).toBeNull()
	})

	it('still hints when isBodyweight is false', () => {
		expect(getProgressHintKg(input({ isBodyweight: false }))).toBe(52.5)
	})

	it('is null without repsMax', () => {
		expect(getProgressHintKg(input({ repsMax: null }))).toBeNull()
	})

	it('is null without last sets or with an empty list', () => {
		expect(getProgressHintKg(input({ lastSets: null }))).toBeNull()
		expect(getProgressHintKg(input({ lastSets: [] }))).toBeNull()
	})

	it('falls back to the template weight for sets without weight', () => {
		const lastSets = [set({ weightKg: null }), set({ weightKg: null })]
		expect(getProgressHintKg(input({ lastSets, weightKg: 40 }))).toBe(42.5)
	})

	it('treats a set with the template weight like a set with its own equal weight', () => {
		const lastSets = [set({ weightKg: null }), set({ weightKg: 40 })]
		expect(getProgressHintKg(input({ lastSets, weightKg: 40 }))).toBe(42.5)
	})

	it('is null when no set has a weight and the template has none', () => {
		expect(getProgressHintKg(input({ lastSets: [set({ weightKg: null })] }))).toBeNull()
	})

	it('ignores warmup sets', () => {
		const lastSets = [set({ weightKg: 20, reps: 5, isWarmup: true }), set(), set()]
		expect(getProgressHintKg(input({ lastSets }))).toBe(52.5)
	})

	it('is null when only warmup sets exist', () => {
		expect(getProgressHintKg(input({ lastSets: [set({ isWarmup: true })] }))).toBeNull()
	})
})
