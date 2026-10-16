// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { FeedItem } from '../model/feed.types'
import { UserMessage } from './UserMessage'

type UserFeedItem = Extract<FeedItem, { kind: 'user' }>

const FILE_ID = '0199b3a4-0000-7000-8000-0000000000f1'
const BLOB_URL = 'blob:http://localhost/sent'
const PHOTO_ALT = 'Фото їжі'
const LOADING = 'Фото завантажується'
const PLACEHOLDER = 'Фото'
const MISSING = 'Фото не збереглося'
const UPLOAD_LABEL = 'Надсилання фото'

const createItem = (overrides: Partial<UserFeedItem> = {}): UserFeedItem => ({
	kind: 'user',
	key: 'u1',
	text: '',
	state: 'sent',
	...overrides,
})

afterEach(cleanup)

describe('UserMessage', () => {
	it('shows only the words of a message without a photo', () => {
		const { container } = renderWithProviders(<UserMessage item={createItem({ text: 'борщ' })} />)

		expect(screen.getByText('борщ')).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
		expect(container.querySelector('img')).toBeNull()
	})

	it('draws the thumb of a stored photo with the words under it', () => {
		const { container } = renderWithProviders(
			<UserMessage
				item={createItem({
					text: '150 г',
					photo: { kind: 'stored', fileId: FILE_ID, width: 1568, height: 1176 },
				})}
			/>,
		)

		expect(screen.getByRole('img', { name: LOADING })).toBeTruthy()
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			`/api/v1/photos/${FILE_ID}?variant=thumb`,
		)
		expect(screen.getByText('150 г')).toBeTruthy()

		fireEvent.load(container.querySelector('img') as HTMLImageElement)

		expect(screen.getByRole('img', { name: PHOTO_ALT })).toBeTruthy()
	})

	it('puts the words after the picture', () => {
		renderWithProviders(
			<UserMessage
				item={createItem({
					text: '150 г',
					photo: { kind: 'stored', fileId: FILE_ID, width: 100, height: 100 },
				})}
			/>,
		)

		const tile = screen.getByRole('img', { name: LOADING })
		const words = screen.getByText('150 г')

		expect(tile.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it('shows the local copy of a stored photo sent in this session', () => {
		const { container } = renderWithProviders(
			<UserMessage
				item={createItem({
					photo: {
						kind: 'stored',
						fileId: FILE_ID,
						width: 800,
						height: 600,
						previewUrl: BLOB_URL,
					},
				})}
			/>,
		)

		expect(container.querySelector('img')?.getAttribute('src')).toBe(BLOB_URL)
	})

	it('says the file is gone for a stored photo without a file id', () => {
		renderWithProviders(
			<UserMessage
				item={createItem({
					photo: { kind: 'stored', fileId: null, width: 800, height: 600 },
				})}
			/>,
		)

		expect(screen.getByRole('img', { name: MISSING })).toBeTruthy()
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('shows the preview of a photo on its way', () => {
		const { container } = renderWithProviders(
			<UserMessage
				item={createItem({
					state: 'sending',
					photo: { kind: 'preview', url: BLOB_URL, width: 800, height: 600 },
				})}
			/>,
		)

		expect(screen.getByRole('img', { name: PHOTO_ALT })).toBeTruthy()
		expect(container.querySelector('img')?.getAttribute('src')).toBe(BLOB_URL)
	})

	it('draws a «Фото» row instead of a tile for a placeholder', () => {
		const { container } = renderWithProviders(
			<UserMessage item={createItem({ photo: { kind: 'placeholder' } })} />,
		)

		expect(screen.getByText(PLACEHOLDER)).toBeTruthy()
		expect(screen.queryByRole('img', { name: PHOTO_ALT })).toBeNull()
		expect(container.querySelector('img')).toBeNull()
	})

	it('keeps the words under a placeholder', () => {
		renderWithProviders(
			<UserMessage item={createItem({ text: 'обід', photo: { kind: 'placeholder' } })} />,
		)

		expect(screen.getByText(PLACEHOLDER)).toBeTruthy()
		expect(screen.getByText('обід')).toBeTruthy()
	})

	it('draws no words row for a photo without text', () => {
		const { container } = renderWithProviders(
			<UserMessage
				item={createItem({
					photo: { kind: 'stored', fileId: FILE_ID, width: 100, height: 100 },
				})}
			/>,
		)

		expect(container.querySelector('p')).toBeNull()
	})

	it('shows the upload progress only while sending and not complete', () => {
		const photo = { kind: 'preview', url: BLOB_URL, width: 800, height: 600 } as const
		const { rerender } = renderWithProviders(
			<UserMessage item={createItem({ state: 'sending', photo, uploadProgress: 0.4 })} />,
		)
		expect(screen.queryByLabelText(UPLOAD_LABEL)).not.toBeNull()

		rerender(<UserMessage item={createItem({ state: 'sending', photo, uploadProgress: 1 })} />)
		expect(screen.queryByLabelText(UPLOAD_LABEL)).toBeNull()

		rerender(<UserMessage item={createItem({ state: 'sent', photo, uploadProgress: 0.4 })} />)
		expect(screen.queryByLabelText(UPLOAD_LABEL)).toBeNull()
	})
})
