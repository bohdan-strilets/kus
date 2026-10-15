import { type ArgumentsHost, Logger } from '@nestjs/common'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { PhotoPayload } from '../photo'
import { AllExceptionsFilter } from './all-exceptions.filter'

const IMAGE_BASE64 = Buffer.alloc(3000, 0x5a).toString('base64')
const DATA_URL = `data:image/jpeg;base64,${IMAGE_BASE64}`

const createHost = () => {
	const json = vi.fn()
	const status = vi.fn(() => ({ json }))
	const host = {
		switchToHttp: () => ({ getResponse: () => ({ status }) }),
	} as unknown as ArgumentsHost
	return { host, status, json }
}

describe('AllExceptionsFilter and photos', () => {
	const filter = new AllExceptionsFilter()
	const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	const logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	beforeEach(() => {
		logError.mockClear()
		logWarn.mockClear()
	})

	afterAll(() => {
		logError.mockRestore()
		logWarn.mockRestore()
	})

	it('answers a broken-JSON 400 without the raw body http-errors carries, and logs nothing', () => {
		// body-parser puts the text it failed to parse into `body`
		const parseError = Object.assign(new SyntaxError('Unexpected end of JSON input'), {
			status: 400,
			expose: true,
			body: `{"photo":{"data":"${IMAGE_BASE64}`,
		})
		const { host, status, json } = createHost()

		filter.catch(parseError, host)

		expect(status).toHaveBeenCalledWith(400)
		expect(json).toHaveBeenCalledWith({ statusCode: 400, errorCode: 'BAD_REQUEST', details: {} })
		expect(JSON.stringify(json.mock.calls)).not.toContain(IMAGE_BASE64)
		expect(logError).not.toHaveBeenCalled()
		expect(logWarn).not.toHaveBeenCalled()
	})

	it('scrubs a data URL from the message of an unexpected error before logging it', () => {
		const { host, json } = createHost()

		filter.catch(new TypeError(`bad image ${DATA_URL} in request`), host)

		const logged = JSON.stringify(logError.mock.calls)
		expect(logged).toContain('[image redacted]')
		expect(logged).toContain('in request')
		expect(logged).not.toContain('base64,')
		expect(logged).not.toContain(IMAGE_BASE64.slice(0, 60))
		expect(JSON.stringify(json.mock.calls)).not.toContain('bad image')
	})

	it('scrubs a bare base64 run too, and keeps a PhotoPayload in an error as a mask', () => {
		const { host } = createHost()
		const photo = new PhotoPayload('image/jpeg', Buffer.alloc(2048, 1), 640, 480)

		filter.catch(new Error(`failed ${IMAGE_BASE64} for ${JSON.stringify({ photo })}`), host)

		const logged = JSON.stringify(logError.mock.calls)
		expect(logged).not.toContain(IMAGE_BASE64.slice(0, 60))
		expect(logged).toContain('[image 2.0 KB]')
	})
})
