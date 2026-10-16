import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { apiErrorBody } from '@/shared/testing'

import { uploadPhoto } from './upload-photo'

const originalAdapter = httpClient.defaults.adapter
const PHOTO_ID = '0199b3a4-0000-7000-8000-0000000000c1'
const PARAMS = { base64: 'AAAA', thumbBase64: 'TTTT', width: 1568, height: 1176 }

const captured: InternalAxiosRequestConfig[] = []

const respondWith = (status: number, data: unknown): void => {
	httpClient.defaults.adapter = (config) => {
		captured.push(config)
		const response = { data, status, statusText: String(status), headers: {}, config }
		if (status < 300) return Promise.resolve(response)
		return Promise.reject(
			new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, response),
		)
	}
}

afterEach(() => {
	httpClient.defaults.adapter = originalAdapter
	captured.length = 0
})

describe('uploadPhoto', () => {
	it('posts the photo and its thumbnail as JPEG to /photos, with the size of the full photo', async () => {
		respondWith(200, { data: { id: PHOTO_ID, width: 1568, height: 1176 } })

		const result = await uploadPhoto(PARAMS)

		expect(result).toEqual({ id: PHOTO_ID, width: 1568, height: 1176 })
		expect(captured).toHaveLength(1)
		expect(captured[0]?.method).toBe('post')
		expect(captured[0]?.url).toBe('/photos')
		expect(JSON.parse(String(captured[0]?.data))).toEqual({
			photo: { mimeType: 'image/jpeg', data: 'AAAA' },
			thumb: { mimeType: 'image/jpeg', data: 'TTTT' },
			width: 1568,
			height: 1176,
		})
	})

	it('waits longer than the default timeout for a slow mobile upload', async () => {
		respondWith(200, { data: { id: PHOTO_ID, width: 1, height: 1 } })

		await uploadPhoto(PARAMS)

		expect(captured[0]?.timeout).toBeGreaterThan(15_000)
	})

	it('reports the upload as a ratio between 0 and 1', async () => {
		httpClient.defaults.adapter = (config) => {
			config.onUploadProgress?.({ loaded: 50, total: 200, bytes: 50, lengthComputable: true })
			config.onUploadProgress?.({ loaded: 500, total: 200, bytes: 500, lengthComputable: true })
			config.onUploadProgress?.({ loaded: 10, bytes: 10, lengthComputable: false })
			return Promise.resolve({
				data: { data: { id: PHOTO_ID, width: 1, height: 1 } },
				status: 200,
				statusText: 'OK',
				headers: {},
				config,
			})
		}
		const onUploadProgress = vi.fn<(ratio: number) => void>()

		await uploadPhoto(PARAMS, { onUploadProgress })

		expect(onUploadProgress.mock.calls.map(([ratio]) => ratio)).toEqual([0.25, 1, 0])
	})

	it('rejects an answer that is not the contract instead of using a bad id', async () => {
		respondWith(200, { data: { id: 'not-a-uuid', width: 1, height: 1 } })

		await expect(uploadPhoto(PARAMS)).rejects.toThrow()
	})

	it('lets the API error through for the caller to map', async () => {
		respondWith(
			429,
			apiErrorBody(429, 'DAILY_PHOTO_LIMIT_REACHED', { resetsAt: '2026-10-17T00:00:00.000Z' }),
		)

		await expect(uploadPhoto(PARAMS)).rejects.toMatchObject({
			response: { status: 429, data: { errorCode: 'DAILY_PHOTO_LIMIT_REACHED' } },
		})
	})
})
