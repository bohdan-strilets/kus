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
	buildReadStepMessages,
	buildRetryMessages,
	selectContextHistory,
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
	isReadToolName,
	type LogMeasurementInput,
	MAX_READ_STEPS,
	type MeasurementPoint,
	mergeParseRefs,
	type ParseRefs,
	type ParseRefsPatch,
	parseToolCalls,
	READ_CLOSED_ERROR,
	READ_DIGESTS_MAX_PER_TURN,
	READ_TOOL_NAMES,
	splitToolCalls,
	type StatsCard,
	withUserCacheBreakpoint,
} from '@kus/shared'
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai'

import type { Env } from '../../config'
import {
	AiRunPurpose,
	AiRunStatus,
	type Prisma,
	ToolCallStatus,
} from '../../generated/prisma/client'
import type { AiClient } from './ai-client'
import { toValidationErrorDetail } from './ai-error-detail'
import {
	formatRateLimitDetail,
	getRateLimitInfo,
	getRateLimitWaitMs,
	isRateLimitError,
	type RateLimitInfo,
	waitUnlessAborted,
} from './ai-rate-limit'
import {
	AI_CLIENT,
	AI_PARSE_DEADLINE_MS,
	AI_READ_MIN_REMAINING_MS,
	AI_STATS_ADVICE_DEADLINE_MS,
} from './ai.constants'
import {
	AiRateLimitedException,
	AiUnavailableException,
	MessageTooLongException,
} from './ai.exceptions'
import { AiRepository, type FoodCallName } from './ai.repository'
import type { ReadToolExecutor, ReadToolResult } from './read-tool-executor'

const CHAT_COMPLETIONS_PATH = '/chat/completions'
const INVALID_TOOL_CALLS = 'INVALID_TOOL_CALLS'
const BAD_RESPONSE = 'BAD_RESPONSE'
const OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED'
const READ_TOOL_FAILED = 'READ_TOOL_FAILED'

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
	/**
	 * Answers the model's read calls for this turn; none = no reading (the only state while
	 * READ_TOOL_NAMES is empty).
	 */
	readTools?: ReadToolExecutor
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
	readonly errorCode: string
	readonly durationMs: number
	/** A short technical line for AiRun.errorDetail. */
	readonly detail: string | null

	constructor({
		errorCode,
		durationMs,
		detail = null,
		cause,
	}: {
		errorCode: string
		durationMs: number
		detail?: string | null
		cause?: unknown
	}) {
		super(errorCode, { cause })
		this.errorCode = errorCode
		this.durationMs = durationMs
		this.detail = detail
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

/** A tool call as the AiToolCall row keeps it. */
interface LoggedCall {
	name: string
	input: unknown
	status: ToolCallStatus
	result?: Prisma.InputJsonValue
}

/** Arguments that aren't JSON are kept as text, so the log still shows what the model sent. */
const toToolCallLog = (input: unknown): Prisma.InputJsonValue => {
	if (typeof input === 'string') return { raw: input }
	// parsed JSON from the model — always JSON-serializable
	return (input ?? null) as Prisma.InputJsonValue
}

const parseArguments = (raw: string): Prisma.InputJsonValue => {
	try {
		return toToolCallLog(JSON.parse(raw))
	} catch {
		return { raw }
	}
}

/** What a read leaves in the AiToolCall: the text, and the digest the later history shows. */
const toReadResultLog = ({ text, digest }: ReadToolResult): Prisma.InputJsonValue =>
	digest === undefined ? { text } : { text, digest }

/** The digest a read call stored next to its text; null when there is none (or the row is not ours). */
const getStoredDigest = (result: Prisma.JsonValue): string | null => {
	if (typeof result !== 'object' || result === null || Array.isArray(result)) return null
	const { digest } = result
	return typeof digest === 'string' && digest !== '' ? digest : null
}

/** A read call that ran, one that failed, or one that was left for the next step. */
const getReadCallStatus = ({
	result,
	isFailed,
}: {
	result: ReadToolResult | undefined
	isFailed: boolean
}): ToolCallStatus => {
	if (isFailed) return ToolCallStatus.FAILED
	return result ? ToolCallStatus.SUCCEEDED : ToolCallStatus.REJECTED
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
	 * One model call per step, all inside one deadline. An answer with read-tool calls (READ_TOOL_NAMES)
	 * is answered by the turn's ReadToolExecutor and the model is called again, up to MAX_READ_STEPS
	 * times; any other answer that fails validation gets one retry with the errors. Every call is
	 * recorded as an AiRun (the turn's cost is their sum). Throws AiUnavailableException when nothing
	 * valid came back.
	 */
	async parseFood(params: ParseFoodParams): Promise<FoodParseDecision> {
		const startedAt = Date.now()
		const deadlineAt = startedAt + AI_PARSE_DEADLINE_MS
		const signal = AbortSignal.timeout(AI_PARSE_DEADLINE_MS)
		const reader = READ_TOOL_NAMES.size > 0 ? params.readTools : undefined
		const firstMessages = buildFoodParseMessages(params.context, params.text, params.image)
		let messages: AiRequestMessage[] = reader
			? withUserCacheBreakpoint(firstMessages)
			: firstMessages
		let refs = getParseRefs(params.context)
		let readSteps = 0
		let retries = 0

		// every pass is one model call: reads, the answer and its retry bound the count
		for (let call = 0; call < MAX_READ_STEPS + 1 + AI_VALIDATION_RETRY_COUNT; call += 1) {
			const { completion, durationMs } = await this.requestCompletion({
				params,
				messages,
				signal,
				deadlineAt,
				kind: PARSE_CALL,
			})
			const isTruncated = isOutputTruncated(completion)
			const toolCalls = completion.choices[0]?.message.tool_calls ?? []
			const wantsRead = !isTruncated && toolCalls.some((item) => isReadToolName(item.function.name))
			const timeLeftMs = AI_PARSE_DEADLINE_MS - (Date.now() - startedAt)
			if (
				wantsRead &&
				reader &&
				readSteps < MAX_READ_STEPS &&
				timeLeftMs >= AI_READ_MIN_REMAINING_MS
			) {
				const step = await this.runReadStep({ params, reader, completion, durationMs, signal })
				messages = [...messages, ...step.messages]
				refs = mergeParseRefs(refs, step.refsPatch)
				readSteps += 1
				continue
			}

			const parsed = wantsRead
				? this.rejectReads(completion, refs, params)
				: await this.checkWeightJumps(
						parseToolCalls(getRawToolCalls(completion), refs, {
							hasImage: params.image !== undefined,
						}),
						params,
					)
			await this.recordRun(params, {
				completion,
				durationMs,
				calls: parsed.calls,
				errorCode: getRunErrorCode({ isTruncated, isValid: parsed.ok }),
				errorDetail: !isTruncated && !parsed.ok ? toValidationErrorDetail(parsed.errors) : null,
			})
			// the same request would be cut at the same place — retrying only burns money
			if (isTruncated) throw new MessageTooLongException()
			if (parsed.ok) return parsed.decision
			if (retries >= AI_VALIDATION_RETRY_COUNT) break
			retries += 1
			messages = [...messages, ...buildRetryMessages(completion, parsed.errors)]
		}
		throw new AiUnavailableException()
	}

	/** A read call when reading is closed (step limit, little time left, no executor): «answer now». */
	private rejectReads(
		completion: AiCompletion,
		refs: ParseRefs,
		{ image }: ParseFoodParams,
	): FoodParseResult {
		const { calls } = parseToolCalls(getRawToolCalls(completion), refs, {
			hasImage: image !== undefined,
		})
		const names = new Set(
			getRawToolCalls(completion)
				.map((item) => item.name)
				.filter(isReadToolName),
		)
		return { ok: false, errors: [...names].map((name) => `${name}: ${READ_CLOSED_ERROR}`), calls }
	}

	/**
	 * Runs the read calls of one answer (parallel, at most MAX_PARALLEL_READS) and records the step.
	 * Write calls of the same answer are not executed. A failed read fails the turn: the run is
	 * recorded first, then AI_UNAVAILABLE — the user resends, nothing was written.
	 */
	private async runReadStep({
		params,
		reader,
		completion,
		durationMs,
		signal,
	}: {
		params: ParseFoodParams
		reader: ReadToolExecutor
		completion: AiCompletion
		durationMs: number
		signal: AbortSignal
	}): Promise<{ messages: AiRequestMessage[]; refsPatch: ParseRefsPatch }> {
		const toolCalls = completion.choices[0]?.message.tool_calls ?? []
		const { reads } = splitToolCalls(toolCalls)
		const settled = await Promise.allSettled(
			reads.map((item) =>
				reader.execute(
					{ name: item.function.name, arguments: item.function.arguments },
					{ userId: params.userId, localDate: params.localDate, signal },
				),
			),
		)
		const resultById = new Map<string, ReadToolResult>()
		const failedIds = new Set<string>()
		settled.forEach((outcome, index) => {
			const id = reads[index]?.id
			if (id === undefined) return
			if (outcome.status === 'fulfilled') resultById.set(id, outcome.value)
			else failedIds.add(id)
		})
		const failure = settled.find(
			(outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
		)

		await this.recordRun(params, {
			completion,
			durationMs,
			calls: toolCalls.map((item) => {
				const result = resultById.get(item.id)
				return {
					name: item.function.name,
					input: parseArguments(item.function.arguments),
					status: getReadCallStatus({ result, isFailed: failedIds.has(item.id) }),
					...(result ? { result: toReadResultLog(result) } : {}),
				}
			}),
			errorCode: failure ? READ_TOOL_FAILED : null,
		})
		if (failure) {
			this.logger.warn(
				`AI read tool failed user=${params.userId} message=${params.messageId} ` +
					`error=${failure.reason instanceof Error ? failure.reason.name : 'unknown'}`,
			)
			throw new AiUnavailableException()
		}
		const refsPatch = [...resultById.values()].reduce<ParseRefsPatch>(
			(merged, { refsPatch: patch }) => ({
				memoryRefs: [...(merged.memoryRefs ?? []), ...(patch?.memoryRefs ?? [])],
				copyRefs: [...(merged.copyRefs ?? []), ...(patch?.copyRefs ?? [])],
			}),
			{},
		)
		return { messages: buildReadStepMessages(completion, toolCalls, resultById), refsPatch }
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
		const deadlineAt = Date.now() + deadlineMs
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
			const { completion, durationMs } = await this.requestCompletion({
				params: adviceParams,
				messages,
				signal,
				deadlineAt,
				kind: STATS_ADVICE_CALL,
			})
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
				errorDetail: !isTruncated && !result.ok ? toValidationErrorDetail(result.errors) : null,
				kind: STATS_ADVICE_CALL,
			}).catch((error: unknown) => {
				this.logger.warn(
					`AI run record failed purpose=${STATS_ADVICE_CALL.purpose} user=${params.userId} ` +
						`message=${params.messageId} error=${error instanceof Error ? error.name : 'unknown'}`,
				)
			})
			return isTruncated ? null : text
		} catch (error) {
			if (!(error instanceof AiUnavailableException || error instanceof AiRateLimitedException)) {
				throw error
			}
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

	/**
	 * One model request. A provider 429 is retried here (not by the SDK, see withoutRateLimitRetry):
	 * up to AI_RATE_LIMIT_RETRIES times, waiting as getRateLimitWaitMs says, never past `deadlineAt`.
	 * A 429 that outlasts that is AI_RATE_LIMITED, any other failure AI_UNAVAILABLE; both are
	 * recorded as a FAILED run first.
	 */
	private async requestCompletion({
		params,
		messages,
		signal,
		deadlineAt,
		kind,
	}: {
		params: ParseFoodParams
		messages: AiRequestMessage[]
		signal: AbortSignal
		/** `Date.now()` value the shared signal fires at: the waits between retries must fit before it. */
		deadlineAt: number
		kind: CallKind
	}): Promise<CompletionResult> {
		const startedAt = Date.now()
		let rateLimitRetries = 0
		for (;;) {
			const attemptStartedAt = Date.now()
			try {
				const response = await this.client.post(CHAT_COMPLETIONS_PATH, {
					body: createFoodParseRequest(this.getModel(params), messages),
					signal,
				})
				const parsed = aiCompletionSchema.safeParse(response)
				if (!parsed.success) {
					throw new CompletionFailure({
						errorCode: BAD_RESPONSE,
						durationMs: Date.now() - attemptStartedAt,
					})
				}
				return { completion: parsed.data, durationMs: Date.now() - attemptStartedAt }
			} catch (error) {
				const rateLimit = isRateLimitError(error) ? getRateLimitInfo(error) : null
				if (rateLimit) {
					const attempt = rateLimitRetries + 1
					const waitMs = signal.aborted
						? null
						: getRateLimitWaitMs({
								retryNumber: attempt,
								retryAfterMs: rateLimit.retryAfterMs,
								remainingMs: deadlineAt - Date.now(),
							})
					this.logRateLimit({ params, kind, rateLimit, attempt, waitMs })
					if (waitMs !== null && (await waitUnlessAborted(waitMs, signal))) {
						rateLimitRetries += 1
						continue
					}
				}
				const failure = this.toCompletionFailure(error, {
					durationMs: Date.now() - startedAt,
					rateLimit,
					attempt: rateLimitRetries + 1,
				})
				await this.recordFailedRequest(params, failure, kind)
				throw rateLimit && !signal.aborted
					? new AiRateLimitedException()
					: new AiUnavailableException()
			}
		}
	}

	private toCompletionFailure(
		error: unknown,
		{
			durationMs,
			rateLimit,
			attempt,
		}: { durationMs: number; rateLimit: RateLimitInfo | null; attempt: number },
	): CompletionFailure {
		if (error instanceof CompletionFailure) return error
		return new CompletionFailure({
			errorCode: getRequestErrorCode(error),
			durationMs,
			detail: rateLimit ? formatRateLimitDetail(rateLimit, attempt) : null,
			cause: error,
		})
	}

	/** Metadata only: no body, no messages (CLAUDE.md §10.1). `waitMs` null = no more retries. */
	private logRateLimit({
		params,
		kind,
		rateLimit,
		attempt,
		waitMs,
	}: {
		params: ParseFoodParams
		kind: CallKind
		rateLimit: RateLimitInfo
		attempt: number
		waitMs: number | null
	}): void {
		this.logger.warn(
			`AI provider rate limited purpose=${kind.purpose} user=${params.userId} message=${params.messageId} ` +
				`provider=${rateLimit.provider} retryAfterMs=${rateLimit.retryAfterMs ?? 'none'} attempt=${attempt} ` +
				(waitMs === null ? 'retry=no' : `retry=in ${waitMs}ms`),
		)
	}

	/** How many facts the model forgot in each user message (successful forget_fact calls). */
	async countForgottenFacts(
		userId: string,
		messageIds: string[],
	): Promise<ReadonlyMap<string, number>> {
		const counts = new Map<string, number>()
		if (messageIds.length === 0) return counts
		const rows = await this.aiRepository.findForgetCallMessageIds({ userId, messageIds })
		// a message parsed twice (a turn retried after its write failed) counts only its latest run
		const latestRunByMessage = new Map<string, { aiRunId: string; at: number }>()
		for (const { messageId, aiRunId, runCreatedAt } of rows) {
			const latest = latestRunByMessage.get(messageId)
			if (!latest || runCreatedAt.getTime() > latest.at) {
				latestRunByMessage.set(messageId, { aiRunId, at: runCreatedAt.getTime() })
			}
		}
		for (const { messageId, aiRunId } of rows) {
			if (latestRunByMessage.get(messageId)?.aiRunId !== aiRunId) continue
			counts.set(messageId, (counts.get(messageId) ?? 0) + 1)
		}
		return counts
	}

	/** Which food each forget_food (agreed) and restore_food call of the turn changed; in the turn's transaction. */
	async recordFoodCallResults(
		params: {
			userId: string
			messageId: string
			results: { name: FoodCallName; ref: string; myFoodId: string }[]
		},
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await this.aiRepository.setFoodCallResults(params, tx)
	}

	/**
	 * Per user message: the ids of the saved foods Kusik removed (forget_food, agreed) and brought
	 * back (restore_food) answering it. A message parsed twice counts only its latest run.
	 */
	async findFoodActions(
		userId: string,
		messageIds: string[],
	): Promise<ReadonlyMap<string, { forgotten: string[]; restored: string[] }>> {
		const actions = new Map<string, { forgotten: string[]; restored: string[] }>()
		if (messageIds.length === 0) return actions
		const rows = await this.aiRepository.findFoodCalls({ userId, messageIds })
		const latestRunByMessage = new Map<string, { aiRunId: string; at: number }>()
		for (const { messageId, aiRunId, runCreatedAt } of rows) {
			const latest = latestRunByMessage.get(messageId)
			if (!latest || runCreatedAt.getTime() > latest.at) {
				latestRunByMessage.set(messageId, { aiRunId, at: runCreatedAt.getTime() })
			}
		}
		for (const { messageId, aiRunId, name, myFoodId } of rows) {
			if (latestRunByMessage.get(messageId)?.aiRunId !== aiRunId) continue
			const own = actions.get(messageId) ?? { forgotten: [], restored: [] }
			const ids = name === AI_TOOL_NAMES.forgetFood ? own.forgotten : own.restored
			if (!ids.includes(myFoodId)) ids.push(myFoodId)
			actions.set(messageId, own)
		}
		return actions
	}

	/**
	 * The digests of what Kusik read in each user message's turn (get_workouts, find_food), oldest
	 * first and at most READ_DIGESTS_MAX_PER_TURN: the history shows them in front of the reply. A
	 * call without a digest (stored before digests existed) is skipped; a retried turn repeats the
	 * same line once.
	 */
	async findReadDigests(
		userId: string,
		messageIds: string[],
	): Promise<ReadonlyMap<string, string[]>> {
		const digests = new Map<string, string[]>()
		if (messageIds.length === 0) return digests
		const rows = await this.aiRepository.findReadCalls({ userId, messageIds })
		for (const { messageId, result } of rows) {
			const digest = getStoredDigest(result)
			if (digest === null) continue
			const known = digests.get(messageId) ?? []
			if (known.includes(digest)) continue
			digests.set(messageId, [...known, digest].slice(-READ_DIGESTS_MAX_PER_TURN))
		}
		return digests
	}

	private async recordRun(
		params: ParseFoodParams,
		{
			completion,
			durationMs,
			calls,
			errorCode,
			errorDetail = null,
			kind = PARSE_CALL,
		}: CompletionResult & {
			calls: LoggedCall[]
			errorCode: string | null
			errorDetail?: string | null
			kind?: CallKind
		},
	): Promise<void> {
		const usage = completion.usage
		const costUsd = usage?.cost ?? 0
		const status = errorCode === null ? AiRunStatus.SUCCEEDED : AiRunStatus.FAILED
		const model = completion.model ?? this.getModel(params)
		const readCount = calls.filter((call) => isReadToolName(call.name)).length

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
			errorDetail,
			toolCalls: calls.map((call) => ({
				name: call.name,
				input: toToolCallLog(call.input),
				status: call.status,
				...(call.result === undefined ? {} : { result: call.result }),
			})),
		})
		await this.aiRepository.addDailyCost({
			userId: params.userId,
			localDate: params.localDate,
			costUsd,
		})
		// counts and an estimate only: the day's history is the part of the input that grows
		const history = selectContextHistory(params.context)
		// metadata only — never message text or food (CLAUDE.md §10.1)
		const log = errorCode === OUTPUT_TRUNCATED ? 'warn' : 'log'
		this.logger[log](
			`AI run ${status} purpose=${kind.purpose} user=${params.userId} message=${params.messageId} ` +
				`model=${model} in=${usage?.prompt_tokens ?? 0} cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} ` +
				`out=${usage?.completion_tokens ?? 0} cost=${costUsd} ms=${durationMs} toolCalls=${calls.length}` +
				` history=${history.messages.length} historyTokens~${history.tokens} historyDropped=${history.droppedCount}` +
				(readCount > 0 ? ` reads=${readCount}` : '') +
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
			errorDetail: failure.detail,
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
