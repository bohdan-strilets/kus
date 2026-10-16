// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRefreshInterceptor, httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderWithProviders } from '@/shared/testing'

import { PhotoTile } from './PhotoTile'

const FILE_ID = '0199b3a4-0000-7000-8000-0000000000f1'
const THUMB_URL = `/api/v1/photos/${FILE_ID}?variant=thumb`
const ALT = 'Фото їжі'
const RETRY = 'Повторити'

const originalAdapter = httpClient.defaults.adapter
let detach: (() => void) | null = null

afterEach(() => {
	cleanup()
	detach?.()
	detach = null
	httpClient.defaults.adapter = originalAdapter
})

describe('PhotoTile retry with the real session renewal', () => {
	it('renews the expired session, then shows the picture', async () => {
		let isAccessValid = false
		const fake = createFakeAdapter(({ url }) => {
			if (url === '/auth/refresh') {
				isAccessValid = true
				return { status: 204 }
			}
			return isAccessValid
				? { status: 200, data: { data: {} } }
				: { status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') }
		})
		httpClient.defaults.adapter = fake.adapter
		detach = attachRefreshInterceptor(httpClient, {
			refresh: async () => {
				await httpClient.post('/auth/refresh')
			},
			onRefreshFailed: vi.fn(),
		})
		const user = userEvent.setup()
		const { container } = renderWithProviders(
			<PhotoTile width={1568} height={1176} alt={ALT} fileId={FILE_ID} />,
		)
		// the thumb answered 401 (<img> has no refresh logic)
		fireEvent.error(container.querySelector('img') as HTMLImageElement)

		await user.click(screen.getByRole('button', { name: RETRY }))

		const again = await waitFor(() => {
			const image = container.querySelector('img')
			if (!image) throw new Error('no <img> yet')
			return image
		})
		expect(fake.calls).toEqual(['/users/me', '/auth/refresh', '/users/me'])
		expect(again.getAttribute('src')).toBe(THUMB_URL)
		fireEvent.load(again)
		expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
	})
})
