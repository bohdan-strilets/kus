// @vitest-environment jsdom
import { isValidElement } from 'react'
import { matchRoutes, type RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ROUTES, TRAINING_FILL_ROUTE, TRAINING_LIVE_ROUTE } from '@/shared/config'

import {
	TrainingFillPage,
	TrainingLivePage,
	TrainingPage,
	TrainingSessionPage,
	TrainingStatsPage,
} from './lazy-pages'
import { RootLayout } from './RootLayout'
import { router } from './router'
import { StackLayout } from './StackLayout'

const SESSION_ID = '0199b3a4-0000-7000-8000-0000000000f1'

const elementType = (route: RouteObject): unknown =>
	isValidElement(route.element) ? route.element.type : null

/** The chain of layouts and the page the real route table gives for a path. */
const resolve = (pathname: string) => {
	const matches = matchRoutes(router.routes, pathname) ?? []
	const types = matches.map((match) => elementType(match.route))
	return {
		page: types.at(-1),
		hasTabLayout: types.includes(RootLayout),
		hasStackLayout: types.includes(StackLayout),
		params: matches.at(-1)?.params ?? {},
	}
}

describe('training routes', () => {
	it('/app/training/live is the live screen, not a session with id «live»', () => {
		const resolved = resolve(TRAINING_LIVE_ROUTE)

		expect(resolved.page).toBe(TrainingLivePage)
		expect(resolved.params).not.toHaveProperty('id')
	})

	it('/app/training/fill is the form, not a session with id «fill»', () => {
		const resolved = resolve(TRAINING_FILL_ROUTE)

		expect(resolved.page).toBe(TrainingFillPage)
		expect(resolved.params).not.toHaveProperty('id')
	})

	it('both full screens render without the bottom nav (the stack layout)', () => {
		for (const path of [TRAINING_LIVE_ROUTE, TRAINING_FILL_ROUTE]) {
			const resolved = resolve(path)

			expect(resolved.hasStackLayout).toBe(true)
			expect(resolved.hasTabLayout).toBe(false)
		}
	})

	it('a real session id still reaches the session screen, inside the tab layout', () => {
		const resolved = resolve(`${ROUTES.training}/${SESSION_ID}`)

		expect(resolved.page).toBe(TrainingSessionPage)
		expect(resolved.params).toMatchObject({ id: SESSION_ID })
		expect(resolved.hasTabLayout).toBe(true)
	})

	it('the tab and its stats stay in the tab layout', () => {
		expect(resolve(ROUTES.training).page).toBe(TrainingPage)
		expect(resolve(ROUTES.training).hasTabLayout).toBe(true)
		expect(resolve(`${ROUTES.training}/stats`).page).toBe(TrainingStatsPage)
	})
})
