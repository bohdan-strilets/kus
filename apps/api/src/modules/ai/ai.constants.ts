import { seconds } from '@nestjs/throttler'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** DI token of the OpenAI-compatible client; e2e tests replace it with a fake. */
export const AI_CLIENT = Symbol('AI_CLIENT')

/** The SDK retries a network error / 5xx / 429 once on its own. */
export const AI_NETWORK_RETRIES = 1
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
