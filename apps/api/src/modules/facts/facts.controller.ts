import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
} from '@nestjs/common'
import type { FactResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { AnswerFactDto, FactParamsDto, UpdateFactDto } from './dto'
import { FactsService } from './facts.service'

/** «Пам'ять · Про тебе» and the «Так / Ні» plaque under a proposal in the chat. */
@Controller('facts')
export class FactsController {
	constructor(private readonly factsService: FactsService) {}

	@Get()
	list(@CurrentUser() user: AuthenticatedUser): Promise<FactResponse[]> {
		return this.factsService.list(user.sub)
	}

	@Patch(':id')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: FactParamsDto,
		@Body() { text }: UpdateFactDto,
	): Promise<FactResponse> {
		return this.factsService.update(user.sub, id, text)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser, @Param() { id }: FactParamsDto): Promise<void> {
		return this.factsService.remove(user.sub, id)
	}

	@Post(':id/restore')
	@HttpCode(HttpStatus.OK)
	restore(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: FactParamsDto,
	): Promise<FactResponse> {
		return this.factsService.restore(user.sub, id)
	}

	@Post(':id/answer')
	@HttpCode(HttpStatus.OK)
	answer(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: FactParamsDto,
		@Body() body: AnswerFactDto,
	): Promise<FactResponse> {
		return this.factsService.answer(user.sub, id, body)
	}
}
