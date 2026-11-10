import { describe, expect, it, vi } from 'vitest'

import { withoutRateLimitRetry } from './ai-client'

const respond = (status: number, headers: Record<string, string> = {}) =>
	withoutRateLimitRetry(vi.fn(() => Promise.resolve(new Response('{}', { status, headers }))))

describe('withoutRateLimitRetry', () => {
	it('tells the SDK not to retry a 429 and keeps its Retry-After and body', async () => {
		const response = await respond(429, { 'retry-after': '7' })('https://example.test')

		expect(response.status).toBe(429)
		expect(response.headers.get('x-should-retry')).toBe('false')
		expect(response.headers.get('retry-after')).toBe('7')
		expect(await response.text()).toBe('{}')
	})

	it('leaves other statuses to the SDK', async () => {
		for (const status of [200, 500, 503]) {
			const response = await respond(status)('https://example.test')
			expect(response.headers.get('x-should-retry')).toBeNull()
		}
	})
})
