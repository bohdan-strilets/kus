import type { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

import type { Env } from '../../config'
import { AI_CLIENT, AI_NETWORK_RETRIES, OPENROUTER_BASE_URL } from './ai.constants'

/** What AiService needs from the SDK: a raw POST, so OpenRouter-only fields pass untyped. */
export interface AiClient {
	post: (path: string, options: { body: unknown; signal: AbortSignal }) => PromiseLike<unknown>
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
		}),
}
