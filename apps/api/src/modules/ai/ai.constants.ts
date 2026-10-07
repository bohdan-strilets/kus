import { minutes } from '@nestjs/throttler'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** DI token of the OpenAI-compatible client; e2e tests replace it with a fake. */
export const AI_CLIENT = Symbol('AI_CLIENT')

/** The SDK retries a network error / 5xx / 429 once on its own. */
export const AI_NETWORK_RETRIES = 1
/** Upper bound for the whole parse, retries included (2 attempts × the 60 s timeout). */
export const AI_PARSE_DEADLINE_MS = minutes(2)

/** AiToolCall rows hold food data and are kept only for prompt debugging (docs/database.md). */
export const TOOL_CALL_RETENTION_DAYS = 30
