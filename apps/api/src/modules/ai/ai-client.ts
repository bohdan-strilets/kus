import type { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

import type { Env } from '../../config'
import { AI_CLIENT, AI_NETWORK_RETRIES, OPENROUTER_BASE_URL } from './ai.constants'

/** What AiService needs from the SDK: a raw POST, so OpenRouter-only fields pass untyped. */
export interface AiClient {
	post: (path: string, options: { body: unknown; signal: AbortSignal }) => PromiseLike<unknown>
}

const HTTP_TOO_MANY_REQUESTS = 429

/**
 * The SDK would retry a 429 on its own, and it knows nothing of the turn's deadline. The header it
 * obeys (`x-should-retry`) turns that off for 429 only; AiService retries it within the deadline.
 * Network errors and 5xx keep the SDK's retry.
 */
export const withoutRateLimitRetry =
	(baseFetch: typeof fetch): typeof fetch =>
	async (input, init) => {
		const response = await baseFetch(input, init)
		if (response.status !== HTTP_TOO_MANY_REQUESTS) return response
		const headers = new Headers(response.headers)
		headers.set('x-should-retry', 'false')
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	}

export const aiClientProvider: Provider = {
	provide: AI_CLIENT,
	inject: [ConfigService],
	useFactory: (config: ConfigService<Env, true>): AiClient =>
		new OpenAI({
			baseURL: OPENROUTER_BASE_URL,
			apiKey: config.get('OPENROUTER_API_KEY', { infer: true }),
			timeout: config.get('AI_TIMEOUT_MS', { infer: true }),
			maxRetries: AI_NETWORK_RETRIES,
			fetch: withoutRateLimitRetry(globalThis.fetch),
			// 'debug' (OPENAI_LOG) would print request bodies, photos included (CLAUDE.md §10.1)
			logLevel: 'warn',
		}),
}
