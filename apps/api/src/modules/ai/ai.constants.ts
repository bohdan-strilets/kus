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
 * Upper bound for the whole parse, every retry included (validation retry × the SDK's network
 * retry): 2 attempts × the 45 s default fit, and with the DB budget it ends before Vercel's 120 s.
 */
export const AI_PARSE_DEADLINE_MS = seconds(95)

/** AiToolCall rows hold food data and are kept only for prompt debugging (docs/database.md). */
export const TOOL_CALL_RETENTION_DAYS = 30
