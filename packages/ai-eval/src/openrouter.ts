import {
	type AiCompletion,
	aiCompletionSchema,
	type AiReasoningMode,
	type AiRequestMessage,
	createFoodParseRequest,
} from '@kus/shared'

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const REQUEST_TIMEOUT_MS = 60_000
/** Same as the backend's SDK setting: one more try on a network error, 429 or 5xx. */
const NETWORK_RETRIES = 1
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504])

export interface CompletionResponse {
	completion: AiCompletion
	latencyMs: number
}

export interface EvalModelOptions {
	apiKey: string
	model: string
	reasoning: AiReasoningMode
}

export class OpenRouterError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message)
	}
}

const postOnce = async (apiKey: string, body: unknown): Promise<unknown> => {
	const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'X-Title': 'Kusik ai-eval',
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
	if (!response.ok) {
		throw new OpenRouterError(`HTTP_${response.status}`, (await response.text()).slice(0, 300))
	}
	return response.json()
}

const isRetryable = (error: unknown): boolean =>
	error instanceof OpenRouterError
		? RETRYABLE_STATUS.has(Number(error.code.replace('HTTP_', '')))
		: true

export const requestFoodParse = async (
	{ apiKey, model, reasoning }: EvalModelOptions,
	messages: AiRequestMessage[],
): Promise<CompletionResponse> => {
	const body = createFoodParseRequest(model, messages, { reasoning })
	const startedAt = Date.now()
	let lastError: unknown
	for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt += 1) {
		try {
			const json = await postOnce(apiKey, body)
			const parsed = aiCompletionSchema.safeParse(json)
			if (!parsed.success) {
				throw new OpenRouterError('BAD_RESPONSE', JSON.stringify(json).slice(0, 300))
			}
			return { completion: parsed.data, latencyMs: Date.now() - startedAt }
		} catch (error) {
			lastError = error
			if (!isRetryable(error)) break
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
