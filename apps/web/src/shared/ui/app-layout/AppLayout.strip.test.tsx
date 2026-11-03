// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppLayout } from './AppLayout'

afterEach(cleanup)

const getMain = (): HTMLElement => screen.getByRole('main')

describe('AppLayout mini strip', () => {
	it('shows the strip over the nav and keeps room for both under the content', () => {
		render(
			<AppLayout bottomNav={<nav aria-label="tabs" />} miniStrip={<a href="/live">strip</a>}>
				content
			</AppLayout>,
		)

		expect(screen.getByRole('link', { name: 'strip' })).toBeTruthy()
		expect(screen.getByRole('navigation', { name: 'tabs' })).toBeTruthy()
		expect(getMain().className).toContain('pb-nav-room-strip')
		expect(getMain().className).not.toContain('pb-nav-room-raised')
	})

	it("without a strip the room is the nav's own", () => {
		render(<AppLayout bottomNav={<nav aria-label="tabs" />}>content</AppLayout>)

		expect(getMain().className).toContain('pb-nav-room')
		expect(getMain().className).not.toContain('pb-nav-room-strip')
	})

	it('a raised nav keeps its own extra room when there is no strip', () => {
		render(
			<AppLayout bottomNav={<nav aria-label="tabs" />} hasRaisedNav>
				content
			</AppLayout>,
		)

		expect(getMain().className).toContain('pb-nav-room-raised')
	})

	it('the strip is not shown without the nav (a pushed screen has neither)', () => {
		render(<AppLayout miniStrip={<a href="/live">strip</a>}>content</AppLayout>)

		expect(screen.queryByRole('link', { name: 'strip' })).toBeNull()
		expect(getMain().className).not.toContain('pb-nav-room')
	})
})
