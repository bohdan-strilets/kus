import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	type AiCompletion,
	AI_VALIDATION_RETRY_COUNT,
	aiCompletionSchema,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	createFoodParseRequest,
	type FoodParseContext,
	type FoodParseDecision,
	getRawToolCalls,
	type ParsedToolCall,
	parseToolCalls,
} from '@kus/shared'
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai'

import type { Env } from '../../config'
import { AiRunPurpose, AiRunStatus, type Prisma } from '../../generated/prisma/client'
import type { AiClient } from './ai-client'
import { AI_CLIENT, AI_PARSE_DEADLINE_MS } from './ai.constants'
import { AiUnavailableException } from './ai.exceptions'
import { AiRepository } from './ai.repository'

const CHAT_COMPLETIONS_PATH = '/chat/completions'
const INVALID_TOOL_CALLS = 'INVALID_TOOL_CALLS'
const BAD_RESPONSE = 'BAD_RESPONSE'

export interface ParseFoodParams {
	userId: string
	messageId: string
	/** The user's calendar day, for the daily cost counter. */
	localDate: Date
	context: FoodParseContext
	text: string
	/** Memory refs present in `context`; any other ref from the model is rejected. */
	memoryRefs: ReadonlySet<string>
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

	constructor(
		@Inject(AI_CLIENT) private readonly client: AiClient,
		private readonly aiRepository: AiRepository,
		config: ConfigService<Env, true>,
	) {
		this.parseModel = config.get('AI_MODEL', { infer: true })
	}

	/**
	 * One model call per attempt; an answer that fails validation gets one retry with the errors.
	 * Every call is recorded as an AiRun. Throws AiUnavailableException when nothing valid came back.
	 */
	async parseFood(params: ParseFoodParams): Promise<FoodParseDecision> {
		const signal = AbortSignal.timeout(AI_PARSE_DEADLINE_MS)
		let messages: AiRequestMessage[] = buildFoodParseMessages(params.context, params.text)

		for (let attempt = 0; attempt <= AI_VALIDATION_RETRY_COUNT; attempt += 1) {
			const { completion, durationMs } = await this.requestCompletion(params, messages, signal)
			const result = parseToolCalls(getRawToolCalls(completion), { memoryRefs: params.memoryRefs })
			await this.recordRun(params, {
				completion,
				durationMs,
				calls: result.calls,
				errorCode: result.ok ? null : INVALID_TOOL_CALLS,
			})
			if (result.ok) return result.decision
			messages = [...messages, ...buildRetryMessages(completion, result.errors)]
		}
		throw new AiUnavailableException()
	}

	private async requestCompletion(
		params: ParseFoodParams,
		messages: AiRequestMessage[],
		signal: AbortSignal,
	): Promise<CompletionResult> {
		const startedAt = Date.now()
		try {
			const response = await this.client.post(CHAT_COMPLETIONS_PATH, {
				body: createFoodParseRequest(this.parseModel, messages),
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
			await this.recordFailedRequest(params, failure)
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
		}: CompletionResult & { calls: ParsedToolCall[]; errorCode: string | null },
	): Promise<void> {
		const usage = completion.usage
		const costUsd = usage?.cost ?? 0
		const status = errorCode === null ? AiRunStatus.SUCCEEDED : AiRunStatus.FAILED
		const model = completion.model ?? this.parseModel

		await this.aiRepository.createRun({
			userId: params.userId,
			messageId: params.messageId,
			purpose: AiRunPurpose.PARSE_FOOD,
			model,
			inputTokens: usage?.prompt_tokens ?? 0,
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
		this.logger.log(
			`AI run ${status} purpose=PARSE_FOOD user=${params.userId} message=${params.messageId} ` +
				`model=${model} in=${usage?.prompt_tokens ?? 0} cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} ` +
				`out=${usage?.completion_tokens ?? 0} cost=${costUsd} ms=${durationMs} toolCalls=${calls.length}` +
				(errorCode ? ` error=${errorCode}` : ''),
		)
	}

	private async recordFailedRequest(
		params: ParseFoodParams,
		failure: CompletionFailure,
	): Promise<void> {
		await this.aiRepository.createRun({
			userId: params.userId,
			messageId: params.messageId,
			purpose: AiRunPurpose.PARSE_FOOD,
			model: this.parseModel,
			inputTokens: 0,
			outputTokens: 0,
			costUsd: 0,
			durationMs: failure.durationMs,
			status: AiRunStatus.FAILED,
			errorCode: failure.errorCode,
			toolCalls: [],
		})
		this.logger.warn(
			`AI request failed purpose=PARSE_FOOD user=${params.userId} message=${params.messageId} ` +
				`model=${this.parseModel} ms=${failure.durationMs} error=${failure.errorCode}`,
		)
	}
}
