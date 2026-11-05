import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	type AiCompletion,
	type AiImageInput,
	AI_VALIDATION_RETRY_COUNT,
	aiCompletionSchema,
	type AiRequestMessage,
	AI_TOOL_NAMES,
	buildFoodParseMessages,
	buildRetryMessages,
	buildStatsAdviceToolResult,
	createFoodParseRequest,
	type FoodParseContext,
	type FoodParseDecision,
	type FoodParseResult,
	getJumpErrors,
	getMeasurementDay,
	getParseRefs,
	getRawToolCalls,
	hasMemoryActions,
	isOutputTruncated,
	type LogMeasurementInput,
	type MeasurementPoint,
	type ParsedToolCall,
	parseToolCalls,
	type StatsCard,
} from '@kus/shared'
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai'

import type { Env } from '../../config'
import { AiRunPurpose, AiRunStatus, type Prisma } from '../../generated/prisma/client'
import type { AiClient } from './ai-client'
import { AI_CLIENT, AI_PARSE_DEADLINE_MS, AI_STATS_ADVICE_DEADLINE_MS } from './ai.constants'
import { AiUnavailableException, MessageTooLongException } from './ai.exceptions'
import { AiRepository } from './ai.repository'

const CHAT_COMPLETIONS_PATH = '/chat/completions'
const INVALID_TOOL_CALLS = 'INVALID_TOOL_CALLS'
const BAD_RESPONSE = 'BAD_RESPONSE'
const OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED'

const getRunErrorCode = ({
	isTruncated,
	isValid,
}: {
	isTruncated: boolean
	isValid: boolean
}): string | null => {
	if (isTruncated) return OUTPUT_TRUNCATED
	return isValid ? null : INVALID_TOOL_CALLS
}

export interface ParseFoodParams {
	userId: string
	messageId: string
	/** The user's calendar day, for the daily cost counter. */
	localDate: Date
	/** Its refs (saved foods, today's entries, open questions) are the only ones the model may use. */
	context: FoodParseContext
	text: string
	/** The photo of the message. Its base64 only goes into the request body, never into a log. */
	image?: AiImageInput
	/**
	 * The user's nearest weight before a day (`YYYY-MM-DD`), for the jump check: it asks the database,
	 * not the context, so a backdated weight is compared with its real neighbour.
	 */
	findPreviousWeight: (localDate: string) => Promise<MeasurementPoint | null>
}

/** What a model call is recorded as. */
interface CallKind {
	purpose: AiRunPurpose
}

const PARSE_CALL: CallKind = { purpose: AiRunPurpose.PARSE_FOOD }
const STATS_ADVICE_CALL: CallKind = {
	purpose: AiRunPurpose.CHAT_REPLY,
}
/** A stand-in id: the first call's own id is gone once its answer became a decision. */
const STATS_TOOL_CALL_ID = 'call_show_stats'

export interface RequestStatsAdviceParams {
	params: ParseFoodParams
	/** The show_stats answer of the first call, as it was validated. */
	stats: Extract<FoodParseDecision, { kind: 'stats' }>
	card: StatsCard
	/** The call's own time limit; the turn passes what is left of the proxy budget. */
	deadlineMs?: number
}

interface CompletionResult {
	completion: AiCompletion
	durationMs: number
}

class CompletionFailure extends Error {
	constructor(
		readonly errorCode: string,
		readonly durationMs: number,
		options?: ErrorOptions,
	) {
		super(errorCode, options)
	}
}

const getRequestErrorCode = (error: unknown): string => {
	// order matters: the timeout error extends the connection error, and both extend APIError
	if (error instanceof APIConnectionTimeoutError) return 'TIMEOUT'
	if (error instanceof APIUserAbortError) return 'DEADLINE'
	if (error instanceof APIConnectionError) return 'NETWORK'
	if (error instanceof APIError && error.status !== undefined) return `HTTP_${error.status}`
	return 'UNKNOWN'
}

/** A reply that does more than answer: a weight, a memory action or a program card. */
const hasSideEffects = (decision: Extract<FoodParseDecision, { kind: 'reply' }>): boolean =>
	decision.measurements.length > 0 ||
	decision.measurementDeletions.length > 0 ||
	hasMemoryActions(decision.memory) ||
	decision.attach !== null

/** Arguments that aren't JSON are kept as text, so the log still shows what the model sent. */
const toToolCallLog = (call: ParsedToolCall): Prisma.InputJsonValue => {
	if (typeof call.input === 'string') return { raw: call.input }
	// parsed JSON from the model — always JSON-serializable
	return (call.input ?? null) as Prisma.InputJsonValue
}

@Injectable()
export class AiService {
	private readonly logger = new Logger(AiService.name)
	private readonly parseModel: string
	private readonly visionModel: string

	constructor(
		@Inject(AI_CLIENT) private readonly client: AiClient,
		private readonly aiRepository: AiRepository,
		config: ConfigService<Env, true>,
	) {
		this.parseModel = config.get('AI_MODEL', { infer: true })
		this.visionModel = config.get('AI_MODEL_VISION', { infer: true })
	}

	/**
	 * One model call per attempt; an answer that fails validation gets one retry with the errors.
	 * Every call is recorded as an AiRun. Throws AiUnavailableException when nothing valid came back.
	 */
	async parseFood(params: ParseFoodParams): Promise<FoodParseDecision> {
		const signal = AbortSignal.timeout(AI_PARSE_DEADLINE_MS)
		let messages: AiRequestMessage[] = buildFoodParseMessages(
			params.context,
			params.text,
			params.image,
		)
		const refs = getParseRefs(params.context)

		for (let attempt = 0; attempt <= AI_VALIDATION_RETRY_COUNT; attempt += 1) {
			const { completion, durationMs } = await this.requestCompletion(
				params,
				messages,
				signal,
				PARSE_CALL,
			)
			const result = await this.checkWeightJumps(
				parseToolCalls(getRawToolCalls(completion), refs, {
					hasImage: params.image !== undefined,
				}),
				params,
			)
			const isTruncated = isOutputTruncated(completion)
			await this.recordRun(params, {
				completion,
				durationMs,
				calls: result.calls,
				errorCode: getRunErrorCode({ isTruncated, isValid: result.ok }),
			})
			// the same request would be cut at the same place — retrying only burns money
			if (isTruncated) throw new MessageTooLongException()
			if (result.ok) return result.decision
			messages = [...messages, ...buildRetryMessages(completion, result.errors)]
		}
		throw new AiUnavailableException()
	}

	/**
	 * The second call of «summary and advice»: the same system prompt and tools (so the prefix cache
	 * hits), the first call's messages, its show_stats call and the numbers the backend counted; the
	 * model stays on tool_choice auto (reasoning forbids a forced tool), so its answer is checked:
	 * reply only. Null when nothing usable came back — the caller says so itself. Not a message of
	 * the daily limit; its cost is counted like any run.
	 */
	async requestStatsAdvice({
		params,
		stats,
		card,
		deadlineMs = AI_STATS_ADVICE_DEADLINE_MS,
	}: RequestStatsAdviceParams): Promise<string | null> {
		// the photo of the message is not needed for advice on numbers: less data to the model
		const adviceParams: ParseFoodParams = { ...params, image: undefined }
		const signal = AbortSignal.timeout(deadlineMs)
		const messages: AiRequestMessage[] = [
			...buildFoodParseMessages(params.context, params.text),
			{
				role: 'assistant',
				content: null,
				tool_calls: [
					{
						id: STATS_TOOL_CALL_ID,
						type: 'function',
						function: {
							name: AI_TOOL_NAMES.showStats,
							arguments: JSON.stringify({
								days: stats.days,
								endDate: stats.endDate,
								reply: stats.text,
								advice: true,
							}),
						},
					},
				],
			},
			{
				role: 'tool',
				tool_call_id: STATS_TOOL_CALL_ID,
				content: buildStatsAdviceToolResult(card),
			},
		]
		try {
			const { completion, durationMs } = await this.requestCompletion(
				adviceParams,
				messages,
				signal,
				STATS_ADVICE_CALL,
			)
			const result = parseToolCalls(getRawToolCalls(completion), getParseRefs(params.context), {
				hasImage: false,
			})
			const isTruncated = isOutputTruncated(completion)
			// reply only: anything else (a tool of the first call, a card) is not the advice
			const text =
				result.ok && result.decision.kind === 'reply' && !hasSideEffects(result.decision)
					? result.decision.text
					: null
			// the advice is already paid for: a failed bookkeeping write must not lose it
			await this.recordRun(adviceParams, {
				completion,
				durationMs,
				calls: result.calls,
				errorCode: isTruncated ? OUTPUT_TRUNCATED : text === null ? INVALID_TOOL_CALLS : null,
				kind: STATS_ADVICE_CALL,
			}).catch((error: unknown) => {
				this.logger.warn(
					`AI run record failed purpose=${STATS_ADVICE_CALL.purpose} user=${params.userId} ` +
						`message=${params.messageId} error=${error instanceof Error ? error.name : 'unknown'}`,
				)
			})
			return isTruncated ? null : text
		} catch (error) {
			if (!(error instanceof AiUnavailableException)) throw error
			// the failed request is already recorded and logged by requestCompletion
			return null
		}
	}

	/** A big jump needs the user's word: the model gets the same retry as for any invalid call. */
	private async checkWeightJumps(
		result: FoodParseResult,
		{ context, findPreviousWeight }: ParseFoodParams,
	): Promise<FoodParseResult> {
		if (!result.ok) return result
		const { decision } = result
		const measurements: LogMeasurementInput[] =
			decision.kind === 'log' || decision.kind === 'reply' ? decision.measurements : []
		const { today } = context.measurements
		const errors: string[] = []
		for (const input of measurements) {
			if (input.kind !== 'WEIGHT' || input.confirmedJump) continue
			const previous = await findPreviousWeight(getMeasurementDay(input, today))
			errors.push(...getJumpErrors(input, previous, today))
		}
		return errors.length === 0 ? result : { ok: false, errors, calls: result.calls }
	}

	private getModel({ image }: ParseFoodParams): string {
		return image ? this.visionModel : this.parseModel
	}

	private async requestCompletion(
		params: ParseFoodParams,
		messages: AiRequestMessage[],
		signal: AbortSignal,
		kind: CallKind,
	): Promise<CompletionResult> {
		const startedAt = Date.now()
		try {
			const response = await this.client.post(CHAT_COMPLETIONS_PATH, {
				body: createFoodParseRequest(this.getModel(params), messages),
				signal,
			})
			const parsed = aiCompletionSchema.safeParse(response)
			if (!parsed.success) throw new CompletionFailure(BAD_RESPONSE, Date.now() - startedAt)
			return { completion: parsed.data, durationMs: Date.now() - startedAt }
		} catch (error) {
			const failure =
				error instanceof CompletionFailure
					? error
					: new CompletionFailure(getRequestErrorCode(error), Date.now() - startedAt, {
							cause: error,
						})
			await this.recordFailedRequest(params, failure, kind)
			throw new AiUnavailableException()
		}
	}

	private async recordRun(
		params: ParseFoodParams,
		{
			completion,
			durationMs,
			calls,
			errorCode,
			kind = PARSE_CALL,
		}: CompletionResult & {
			calls: ParsedToolCall[]
			errorCode: string | null
			kind?: CallKind
		},
	): Promise<void> {
		const usage = completion.usage
		const costUsd = usage?.cost ?? 0
		const status = errorCode === null ? AiRunStatus.SUCCEEDED : AiRunStatus.FAILED
		const model = completion.model ?? this.getModel(params)

		await this.aiRepository.createRun({
			userId: params.userId,
			messageId: params.messageId,
			purpose: kind.purpose,
			model,
			inputTokens: usage?.prompt_tokens ?? 0,
			cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
			outputTokens: usage?.completion_tokens ?? 0,
			costUsd,
			durationMs,
			status,
			errorCode,
			toolCalls: calls.map((call) => ({
				name: call.name,
				input: toToolCallLog(call),
				status: call.status,
			})),
		})
		await this.aiRepository.addDailyCost({
			userId: params.userId,
			localDate: params.localDate,
			costUsd,
		})
		// metadata only — never message text or food (CLAUDE.md §10.1)
		const log = errorCode === OUTPUT_TRUNCATED ? 'warn' : 'log'
		this.logger[log](
			`AI run ${status} purpose=${kind.purpose} user=${params.userId} message=${params.messageId} ` +
				`model=${model} in=${usage?.prompt_tokens ?? 0} cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} ` +
				`out=${usage?.completion_tokens ?? 0} cost=${costUsd} ms=${durationMs} toolCalls=${calls.length}` +
				(params.image ? ' photo=1' : '') +
				(errorCode ? ` error=${errorCode}` : ''),
		)
	}

	private async recordFailedRequest(
		params: ParseFoodParams,
		failure: CompletionFailure,
		kind: CallKind,
	): Promise<void> {
		await this.aiRepository.createRun({
			userId: params.userId,
			messageId: params.messageId,
			purpose: kind.purpose,
			model: this.getModel(params),
			inputTokens: 0,
			cachedInputTokens: null,
			outputTokens: 0,
			costUsd: 0,
			durationMs: failure.durationMs,
			status: AiRunStatus.FAILED,
			errorCode: failure.errorCode,
			toolCalls: [],
		})
		this.logger.warn(
			`AI request failed purpose=${kind.purpose} user=${params.userId} message=${params.messageId} ` +
				`model=${this.getModel(params)} ms=${failure.durationMs}` +
				(params.image ? ' photo=1' : '') +
				` error=${failure.errorCode}`,
		)
	}
}
