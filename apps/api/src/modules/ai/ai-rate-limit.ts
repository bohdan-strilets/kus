import { APIError } from 'openai'

import {
	AI_RATE_LIMIT_BACKOFF_MS,
	AI_RATE_LIMIT_MAX_WAIT_MS,
	AI_RATE_LIMIT_MIN_REMAINING_MS,
	AI_RATE_LIMIT_RETRIES,
} from './ai.constants'

const HTTP_TOO_MANY_REQUESTS = 429
const MS_PER_SECOND = 1000
const PROVIDER_NAME_MAX_LENGTH = 40
const UNKNOWN_PROVIDER = 'unknown'

export interface RateLimitInfo {
	/** OpenRouter's `error.metadata.provider_name`: which upstream refused. */
	provider: string
	/** Null = the provider sent no usable Retry-After. */
	retryAfterMs: number | null
}

export const isRateLimitError = (error: unknown): error is APIError =>
	error instanceof APIError && error.status === HTTP_TOO_MANY_REQUESTS

/** `retry-after-ms`, then `retry-after` as seconds or an HTTP date (the same headers the SDK reads). */
const getRetryAfterMs = (headers: Headers | undefined): number | null => {
	if (!headers) return null
	const millis = Number(headers.get('retry-after-ms'))
	if (headers.get('retry-after-ms') !== null && Number.isFinite(millis) && millis >= 0) {
		return Math.round(millis)
	}
	const raw = headers.get('retry-after')
	if (raw === null) return null
	const seconds = Number(raw)
	if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * MS_PER_SECOND)
	const date = Date.parse(raw)
	return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

/** Only the provider's name (letters, digits, `.-_ /:`), cut short: it comes from a response body. */
const getProviderName = (body: unknown): string => {
	if (typeof body !== 'object' || body === null) return UNKNOWN_PROVIDER
	const { metadata } = body as { metadata?: unknown }
	if (typeof metadata !== 'object' || metadata === null) return UNKNOWN_PROVIDER
	const { provider_name: name } = metadata as { provider_name?: unknown }
	if (typeof name !== 'string') return UNKNOWN_PROVIDER
	const clean = name.replace(/[^\w .:/-]/g, '').slice(0, PROVIDER_NAME_MAX_LENGTH)
	return clean === '' ? UNKNOWN_PROVIDER : clean
}

export const getRateLimitInfo = (error: APIError): RateLimitInfo => ({
	provider: getProviderName(error.error),
	retryAfterMs: getRetryAfterMs(error.headers),
})

/**
 * How long to wait before retry number `retryNumber` (1-based) of a 429, or null = do not retry:
 * all retries are used, or the wait would leave less than AI_RATE_LIMIT_MIN_REMAINING_MS of the
 * turn's deadline for the call itself. Retry-After wins over the backoff but is cut to the cap.
 */
export const getRateLimitWaitMs = ({
	retryNumber,
	retryAfterMs,
	remainingMs,
}: {
	retryNumber: number
	retryAfterMs: number | null
	remainingMs: number
}): number | null => {
	if (retryNumber > AI_RATE_LIMIT_RETRIES) return null
	const backoff = AI_RATE_LIMIT_BACKOFF_MS[retryNumber - 1] ?? AI_RATE_LIMIT_MAX_WAIT_MS
	const waitMs = Math.min(retryAfterMs ?? backoff, AI_RATE_LIMIT_MAX_WAIT_MS)
	return remainingMs - waitMs >= AI_RATE_LIMIT_MIN_REMAINING_MS ? waitMs : null
}

/** The `AiRun.errorDetail` of a 429: metadata only. */
export const formatRateLimitDetail = (info: RateLimitInfo, attempt: number): string => {
	const retryAfter =
		info.retryAfterMs === null ? 'none' : `${Math.round(info.retryAfterMs / MS_PER_SECOND)}s`
	return `provider=${info.provider}; retryAfter=${retryAfter}; attempt=${attempt}`
}

/** A wait that the turn's deadline or abort can cut short; false = it was cut. */
export const waitUnlessAborted = (ms: number, signal: AbortSignal): Promise<boolean> =>
	new Promise((resolve) => {
		if (signal.aborted) {
			resolve(false)
			return
		}
		const onAbort = () => {
			clearTimeout(timer)
			resolve(false)
		}
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort)
			resolve(true)
		}, ms)
		signal.addEventListener('abort', onAbort, { once: true })
	})
