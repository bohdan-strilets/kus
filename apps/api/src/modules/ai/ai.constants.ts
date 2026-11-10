import { seconds } from '@nestjs/throttler'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** DI token of the OpenAI-compatible client; e2e tests replace it with a fake. */
export const AI_CLIENT = Symbol('AI_CLIENT')

/** The SDK retries a network error / 5xx once on its own (a 429 is retried by AiService, see below). */
export const AI_NETWORK_RETRIES = 1
/**
 * Retries of a 429 from the provider, made by AiService inside the turn's deadline. Each waits for
 * Retry-After (or the backoff below), at most AI_RATE_LIMIT_MAX_WAIT_MS, and only while at least
 * AI_RATE_LIMIT_MIN_REMAINING_MS of the deadline is left after the wait.
 */
export const AI_RATE_LIMIT_RETRIES = 2
export const AI_RATE_LIMIT_BACKOFF_MS: readonly number[] = [seconds(2), seconds(4)]
export const AI_RATE_LIMIT_MAX_WAIT_MS = seconds(15)
/** `Retry-After: 0` (or an empty header) is not a reason to hit a limited provider again at once. */
export const AI_RATE_LIMIT_MIN_WAIT_MS = seconds(1)
export const AI_RATE_LIMIT_MIN_REMAINING_MS = seconds(10)
/** AiRun.errorDetail is a short technical line, never a log of the exchange. */
export const AI_ERROR_DETAIL_MAX_LENGTH = 500
/**
 * Vercel cuts a proxied request to an external origin after 120 s (vercel.com/docs/limits), and
 * every chat request goes through that rewrite. Past it the phone sees an error while the turn may
 * still finish and log the food.
 */
export const VERCEL_PROXY_TIMEOUT_MS = seconds(120)
/** The DB work around the model call: context before it, the turn transaction and response after. */
export const CHAT_TURN_DB_BUDGET_MS = seconds(20)
/**
 * Upper bound for the whole parse, shared by every call of the turn: up to 1 + MAX_READ_STEPS reads
 * + 1 validation retry = 4 calls, each also bound by its own timeout. With the DB budget it ends
 * before Vercel's 120 s. Typical calls take 5–15 s, so only a slow turn meets the deadline; the
 * read steps give way first (AI_READ_MIN_REMAINING_MS), the last answer keeps the rest.
 */
export const AI_PARSE_DEADLINE_MS = seconds(95)
/** Less time than this left: no more reading, the model answers with what it has. */
export const AI_READ_MIN_REMAINING_MS = seconds(10)
/**
 * The second call of «summary and advice» (a short reply on counted numbers). Its worst case sits
 * on top of AI_PARSE_DEADLINE_MS and the DB budget; a normal parse is far below its own limit.
 */
export const AI_STATS_ADVICE_DEADLINE_MS = seconds(25)
/** Less time than this left before the proxy limit: the second call is skipped. */
export const AI_STATS_ADVICE_MIN_MS = seconds(5)

/** AiToolCall rows hold food data and are kept only for prompt debugging (docs/database.md). */
export const TOOL_CALL_RETENTION_DAYS = 30
