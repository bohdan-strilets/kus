import {
	type AxiosAdapter,
	AxiosError,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from 'axios'

export type FakeReply = { status: number; data?: unknown } | 'network'

/** Decides the reply per request; `call` is the 1-based count of requests to the same url. */
export type FakeHandler = (request: { url: string; call: number }) => FakeReply | Promise<FakeReply>

export interface FakeAdapter {
	adapter: AxiosAdapter
	/** Every request url in order, e.g. ['/users/me', '/auth/refresh', '/users/me']. */
	calls: string[]
	countCalls: (url: string) => number
}

const HTTP_OK_MIN = 200
const HTTP_OK_MAX = 299

const toResponse = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
	({
		data,
		status,
		statusText: String(status),
		headers: {},
		config,
	}) satisfies AxiosResponse

/** Tests only: an in-memory API for an axios instance, no network and no extra libraries. */
export const createFakeAdapter = (handler: FakeHandler): FakeAdapter => {
	const calls: string[] = []
	const countCalls = (url: string): number => calls.filter((call) => call === url).length

	const adapter: AxiosAdapter = async (config) => {
		const url = config.url ?? ''
		calls.push(url)
		const reply = await handler({ url, call: countCalls(url) })

		if (reply === 'network') {
			throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
		}
		const response = toResponse(config, reply.status, reply.data ?? null)
		if (reply.status >= HTTP_OK_MIN && reply.status <= HTTP_OK_MAX) return response
		throw new AxiosError(
			`Request failed with status code ${reply.status}`,
			AxiosError.ERR_BAD_RESPONSE,
			config,
			null,
			response,
		)
	}

	return { adapter, calls, countCalls }
}

export const apiErrorBody = (statusCode: number, errorCode: string, details = {}) => ({
	statusCode,
	errorCode,
	details,
})
